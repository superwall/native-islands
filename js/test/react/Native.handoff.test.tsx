import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlassButton } from "../../src/react";
import {
  installCapability,
  islandOf,
  mockLayout,
  overrideStyle,
  rectAttribute,
  removeCapability,
  renderNative,
  CAPABILITY,
  resetStyleOverrides,
  setScrollGeometry,
} from "./harness";

beforeEach(() => {
  mockLayout();
  installCapability();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  resetStyleOverrides();
  Reflect.deleteProperty(document, "elementsFromPoint");
});

const transition = (type: string, target: Element, propertyName: string) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { propertyName });
  act(() => {
    target.dispatchEvent(event);
  });
};

const Card = (_props: { list?: boolean }) => (
  <div id="card" data-rect={rectAttribute(0, 0, 400, 200)}>
    <GlassButton title="Go">
      <button type="button" data-rect={rectAttribute(10, 150, 100, 40)}>
        Go
      </button>
    </GlassButton>
  </div>
);

describe("hand-off to the web version", () => {
  it("hides the island while an ancestor moves and shows it again, re-measured, after", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    const card = view.container.querySelector("#card") as HTMLElement;

    transition("transitionrun", card, "transform");
    await waitFor(() => expect(island.dataset.islandHandoff).toBe("moving"));
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id: expect.any(String),
      visible: false,
    });
    expect(island.hasAttribute("data-island-shown")).toBe(false);
    expect(island.hasAttribute("aria-hidden")).toBe(false);

    (view.container.querySelector("button") as HTMLElement).dataset.rect = rectAttribute(
      10,
      170,
      100,
      40,
    );
    transition("transitionend", card, "transform");
    await waitFor(() => expect(island.hasAttribute("data-island-shown")).toBe(true));
    await view.nextFrame();
    const updates = view.operations().filter((operation) => operation.op === "update");
    expect(updates.at(-1)).toMatchObject({ visible: true });
    expect(updates.findLast((operation) => "frame" in operation)).toMatchObject({
      frame: { x: 10, y: 170, width: 100, height: 40 },
    });
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    expect(island.hasAttribute("data-island-handoff")).toBe(false);
  });

  it("mounts hidden when the element starts out covered", async () => {
    const modal = document.createElement("div");
    document.body.appendChild(modal);
    Object.assign(document, {
      elementsFromPoint: () => [
        modal,
        document.querySelector("[data-island] > *, [data-island] > *"),
      ],
    });
    const view = renderNative(<Card />);
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({ op: "mount", visible: false });
    expect(islandOf(view.container).dataset.islandHandoff).toBe("covered");
    view.ackAll();
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(false);

    Object.assign(document, {
      elementsFromPoint: () => [document.querySelector("[data-island] > *")],
    });
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(view.operations().at(-1)).toMatchObject({ op: "update", visible: true });
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(true);
    modal.remove();
  });

  it("re-evaluates on re-render and hands off when an ancestor fades", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    overrideStyle(view.container.querySelector("#card") as Element, { opacity: "0.4" });
    view.rerender(<Card list />);
    await view.nextFrame();
    expect(islandOf(view.container).dataset.islandHandoff).toBe("faded");
    expect(view.operations().at(-1)).toMatchObject({ op: "update", visible: false });
  });

  it("stops listening for layout once the island falls back", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_error", id, reason: "render_failed" });
    const before = view.operations().length;
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(
      view
        .operations()
        .slice(before)
        .filter((operation) => operation.op === "update"),
    ).toEqual([]);
  });

  it("skips a layout pass when the children are gone", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    const before = view.operations().length;
    islandOf(view.container).replaceChildren();
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(view.operations()).toHaveLength(before);
  });
});

describe("mounting", () => {
  it("waits for a route to finish its transition before mounting, then mounts where it settled", async () => {
    const fresh = renderNative(
      <div data-island-phase="enter" id="route">
        <Card />
      </div>,
    );
    await fresh.nextFrame();
    expect(fresh.batches()).toEqual([]);
    const route = fresh.container.querySelector("#route") as HTMLElement;
    act(() => {
      route.removeAttribute("data-island-phase");
    });
    await fresh.nextFrame();
    expect(fresh.operations()).toEqual([expect.objectContaining({ op: "mount", visible: true })]);
  });

  it("stops waiting when it unmounts before it could mount", async () => {
    const view = renderNative(
      <div data-island-phase="enter">
        <Card />
      </div>,
    );
    await view.nextFrame();
    view.unmount();
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });

  it("keeps waiting through layout passes that are still unsettled", async () => {
    const view = renderNative(
      <div data-island-phase="enter" id="route">
        <Card />
      </div>,
    );
    await view.nextFrame();
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });
});

describe("anchors", () => {
  it("anchors inside an inner scroller and keeps the anchor while it scrolls", async () => {
    const List = () => (
      <div id="list" data-rect={rectAttribute(0, 100, 400, 300)}>
        <GlassButton title="Go">
          <button type="button" data-rect={rectAttribute(10, 350, 100, 40)}>
            Go
          </button>
        </GlassButton>
      </div>
    );
    const view = renderNative(<List />);
    const list = view.container.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, {
      scrollHeight: 900,
      clientHeight: 300,
      clientWidth: 400,
      scrollTop: 0,
    });
    view.rerender(<List />);
    await view.nextFrame();
    const mount = view.operations().find((operation) => operation.op === "mount");
    expect(mount).toBeDefined();
    view.ackAll();
    const button = view.container.querySelector("button") as HTMLElement;
    setScrollGeometry(list, { scrollTop: 120 });
    button.dataset.rect = rectAttribute(10, 230, 100, 40);
    act(() => {
      list.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    const updates = view
      .operations()
      .filter((operation) => operation.op === "update" && "anchor" in operation);
    expect(
      updates.every(
        (operation) => operation.op === "update" && operation.anchor?.type !== "scroller",
      ),
    ).toBe(true);
  });

  it("re-anchors to the screen when an element becomes fixed", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    overrideStyle(view.container.querySelector("button") as Element, { position: "fixed" });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await view.nextFrame();
    expect(view.operations().at(-1)).toMatchObject({
      op: "update",
      anchor: { type: "screen" },
    });
  });
});

describe("following motion frame by frame", () => {
  it("hides an island whose element moves with no event at all, and shows it once still", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    await view.nextFrame();
    const island = islandOf(view.container);
    const button = view.container.querySelector("button") as HTMLElement;
    const before = view.operations().length;
    button.dataset.rect = rectAttribute(40, 150, 100, 40);
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    await view.nextFrame();
    expect(view.operations().slice(before)).toContainEqual({
      op: "update",
      id: expect.any(String),
      visible: false,
    });
    await view.nextFrame();
    await view.nextFrame();
    expect(island.hasAttribute("data-island-handoff")).toBe(false);
    expect(view.operations().at(-1)).toMatchObject({
      op: "update",
      frame: { x: 40, y: 150, width: 100, height: 40 },
      visible: true,
    });
  });

  it("moves a sticky island with its element instead of hiding it", async () => {
    const view = renderNative(<Card />);
    const button = view.container.querySelector("button") as HTMLElement;
    overrideStyle(button, { position: "sticky" });
    view.rerender(<Card list />);
    await view.nextFrame();
    view.ackAll();
    await view.nextFrame();
    button.dataset.rect = rectAttribute(10, 120, 100, 40);
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    await view.nextFrame();
    expect(islandOf(view.container).hasAttribute("data-island-handoff")).toBe(false);
    const updates = view.operations().filter((operation) => operation.op === "update");
    expect(updates.at(-1)).toMatchObject({ frame: { x: 10, y: 120, width: 100, height: 40 } });
    expect(
      updates.some((operation) => operation.op === "update" && operation.visible === false),
    ).toBe(false);
  });

  it("conceals the faded-out web version from taps and VoiceOver, and reveals it on hand-off", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-concealed")).toBe(false);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(island.hasAttribute("data-island-concealed")).toBe(true);
    transition("transitionrun", view.container.querySelector("#card") as Element, "transform");
    await view.nextFrame();
    expect(island.hasAttribute("data-island-concealed")).toBe(false);
  });
});

describe("islands that cannot be measured", () => {
  it("warns once when there is no element to measure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const view = renderNative(<GlassButton title="Go">Go</GlassButton>);
    await view.nextFrame();
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await view.nextFrame();
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes("no_elements")),
    ).toHaveLength(1);
    expect(view.batches()).toEqual([]);
  });
});

describe("layered hosts", () => {
  const Route = () => (
    <div id="route" data-rect={rectAttribute(0, 0, 400, 600)}>
      <Card />
    </div>
  );

  const scrolling = (view: ReturnType<typeof renderNative>) => {
    const route = view.container.querySelector("#route") as HTMLElement;
    overrideStyle(route, { overflowY: "auto" });
    setScrollGeometry(route, { scrollHeight: 1200, clientHeight: 600, clientWidth: 400 });
    return route;
  };

  it("keeps a route's island native through a page change instead of swapping to web", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "layered"] });
    const view = renderNative(<Route />);
    const route = scrolling(view);
    view.rerender(<Route />);
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({ op: "mount", anchor: { type: "scroller" } });
    view.ackAll();
    act(() => {
      route.setAttribute("data-island-phase", "leave");
      route.setAttribute("inert", "");
    });
    await view.nextFrame();
    expect(view.operations().filter((operation) => operation.op === "update")).not.toContainEqual(
      expect.objectContaining({ visible: false }),
    );
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(true);
  });

  it("still waits for a new page to settle before it mounts", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "layered"] });
    const view = renderNative(
      <div data-island-phase="enter" id="stage">
        <Route />
      </div>,
    );
    scrolling(view);
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    act(() => {
      (view.container.querySelector("#stage") as HTMLElement).removeAttribute("data-island-phase");
    });
    await view.nextFrame();
    expect(view.operations()).toEqual([expect.objectContaining({ op: "mount" })]);
  });
});
