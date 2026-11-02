import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handoffOf, inTransition, type HandoffOptions } from "../src/handoff";
import { createNativeIslands, readNativeCapability, type TToHostMessage } from "../src";
import { placementOf, type NativePlacement } from "../src/measure";
import { createLayoutWatcher } from "../src/watcher";
import {
  mockLayout,
  overrideStyle,
  rectAttribute,
  resetStyleOverrides,
  setScrollGeometry,
} from "./dom";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  resetStyleOverrides();
});

const accordion = () => {
  mockLayout();
  document.body.innerHTML = `
    <div id="route" data-rect="${rectAttribute(0, 0, 400, 800)}">
      <div id="expander" data-rect="${rectAttribute(0, 100, 400, 30)}">
        <div data-island style="display: inline-block" data-rect="${rectAttribute(10, 110, 100, 40)}"></div>
      </div>
    </div>`;
  const route = document.getElementById("route") as HTMLElement;
  const expander = document.getElementById("expander") as HTMLElement;
  overrideStyle(route, { overflowY: "auto" });
  overrideStyle(expander, { overflowY: "hidden", overflowX: "hidden" });
  setScrollGeometry(route, { scrollHeight: 2000, clientHeight: 800, clientWidth: 400 });
  setScrollGeometry(expander, { clientHeight: 30, clientWidth: 400 });
  const wrapper = document.querySelector("[data-island]") as HTMLElement;
  return { route, expander, wrapper, placement: () => placementOf(wrapper) as NativePlacement };
};

describe("clipped islands", () => {
  it("stays native, cut to what a resizing box shows, when the host clips", () => {
    const { wrapper, expander, placement } = accordion();
    const resizing = (element: Element) => element === expander;
    const out: NonNullable<HandoffOptions["out"]> = {};
    expect(
      handoffOf(wrapper, placement(), resizing, true, {
        clip: true,
        isRevealing: resizing,
        out,
      }),
    ).toBeUndefined();
    expect(out.clip).toEqual({ x: 10, y: 110, width: 100, height: 20 });
  });

  it("shows the web version for a box that cuts an island at rest, even when the host clips", () => {
    const { wrapper, placement } = accordion();
    expect(handoffOf(wrapper, placement(), () => false, true, { clip: true })).toBe("clipped");
  });

  it("shows the web version when the host cannot clip", () => {
    const { wrapper, placement } = accordion();
    expect(handoffOf(wrapper, placement(), () => false, true)).toBe("clipped");
  });

  it("hides an island the box cuts off entirely", () => {
    const { wrapper, expander, placement } = accordion();
    expander.dataset.rect = rectAttribute(0, 100, 400, 0);
    setScrollGeometry(expander, { clientHeight: 0 });
    expect(handoffOf(wrapper, placement(), () => false, true, { clip: true })).toBe("hidden");
  });

  it("keeps an island native while the box around it opens, and says so", () => {
    const { wrapper, expander, route, placement } = accordion();
    const moving = (element: Element) => element === expander;
    const out: NonNullable<HandoffOptions["out"]> = {};
    expect(
      handoffOf(wrapper, placement(), moving, true, { clip: true, isRevealing: moving, out }),
    ).toBeUndefined();
    expect(out.revealing).toBe(true);
    expect(handoffOf(wrapper, placement(), moving, true, { clip: true })).toBe("moving");
    expect(inTransition(wrapper, moving, route, moving)).toBe(false);
    expect(inTransition(wrapper, moving, route)).toBe(true);
    expect(inTransition(wrapper, moving, undefined, moving)).toBe(true);
  });
});

describe("layout watcher", () => {
  const transition = (target: Element, type: string, propertyName: string) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { propertyName });
    target.dispatchEvent(event);
  };

  it("tells a box that only resizes from one that moves", () => {
    const watcher = createLayoutWatcher(document);
    const stop = watcher.subscribe(() => undefined);
    const box = document.createElement("div");
    document.body.appendChild(box);
    expect(watcher.isRevealing(box)).toBe(false);
    transition(box, "transitionrun", "max-height");
    expect(watcher.isRevealing(box)).toBe(true);
    transition(box, "transitionrun", "transform");
    expect(watcher.isRevealing(box)).toBe(false);
    stop();
  });

  it("still lays out for DOM changes made before a quiet measurement", async () => {
    const watcher = createLayoutWatcher(document);
    const passes: string[] = [];
    const stop = watcher.subscribe((pass) => passes.push(pass));
    await new Promise((resolve) => setTimeout(resolve, 700));
    passes.length = 0;
    document.body.setAttribute("class", "changed");
    watcher.quietly(() => document.body.setAttribute("style", "color: red"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();
    expect(passes).toContain("layout");
  });

  it("measures quietly before anyone listens", () => {
    expect(createLayoutWatcher(document).quietly(() => 4)).toBe(4);
  });
});

describe("sticky and clipped frames", () => {
  let posted: TToHostMessage[];
  let pending: Array<() => void>;
  beforeEach(() => {
    posted = [];
    pending = [];
  });

  const setup = () => {
    const islands = createNativeIslands({
      capability: readNativeCapability({ protocol: 1, components: { glassButton: 1 } }),
      post: (message) => posted.push(message),
      schedule: (flush) => pending.push(flush),
    });
    const frame = () => {
      for (const flush of pending.splice(0)) flush();
    };
    const operations = () =>
      posted.flatMap((message) =>
        message.event_name === "native_component_batch" ? message.operations : [],
      );
    return { islands, frame, operations };
  };

  const base = {
    component: "glassButton",
    version: 1,
    props: {},
    frame: { x: 0, y: 908, width: 100, height: 44 },
    anchor: { type: "page" as const },
    visible: true,
    order: 0,
    sizing: "web" as const,
  };
  const sticky = {
    bottom: 12,
    box: { x: 0, y: 900, width: 100, height: 60 },
    bounds: { x: 0, y: 0, width: 100, height: 1000 },
  };
  const clip = { x: 0, y: 0, width: 100, height: 10 };

  it("sends the sticky box and clip with the mount, and with the frame when they change", () => {
    const { islands, frame, operations } = setup();
    islands.mount("cta", { ...base, sticky }, {});
    frame();
    expect(operations()[0]).toMatchObject({ op: "mount", sticky });
    expect(operations()[0]).not.toHaveProperty("clip");

    islands.update("cta", { frame: base.frame, sticky, clip });
    frame();
    expect(operations()[1]).toEqual({ op: "update", id: "cta", frame: base.frame, sticky, clip });

    islands.update("cta", { frame: base.frame });
    frame();
    expect(operations()[2]).toEqual({ op: "update", id: "cta", frame: base.frame });

    islands.update("cta", { frame: base.frame });
    islands.update("cta", { visible: false });
    frame();
    expect(operations()[3]).toEqual({ op: "update", id: "cta", visible: false });
  });
});
