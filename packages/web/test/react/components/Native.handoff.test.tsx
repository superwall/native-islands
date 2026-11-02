import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlassButton } from "../../support/components";
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
} from "../../support/react";

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
  it("keeps the island native while an ancestor moves, following its frame", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    const card = view.container.querySelector("#card") as HTMLElement;
    const before = view.operations().length;

    transition("transitionrun", card, "transform");
    (view.container.querySelector("button") as HTMLElement).dataset.rect = rectAttribute(
      10,
      170,
      100,
      40,
    );
    await view.nextFrame();
    await view.nextFrame();
    const updates = view.operations().slice(before);
    expect(updates).not.toContainEqual(expect.objectContaining({ visible: false }));
    expect(updates.findLast((operation) => "frame" in operation)).toMatchObject({
      frame: { x: 10, y: 170, width: 100, height: 40 },
    });
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    expect(island.hasAttribute("data-island-handoff")).toBe(false);
    transition("transitionend", card, "transform");
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
    expect(islandOf(view.container).getAttribute("aria-hidden")).toBe("true");
  });

  it("leaves the web copy readable for an island drawn inside the web content", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    await view.nextFrame();
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    expect(island.hasAttribute("aria-hidden")).toBe(false);
  });
});

describe("following motion frame by frame", () => {
  it("moves an island whose element moves with no event at all, without hiding it", async () => {
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
    const updates = view.operations().slice(before);
    expect(updates).not.toContainEqual(expect.objectContaining({ visible: false }));
    expect(updates.at(-1)).toMatchObject({
      op: "update",
      frame: { x: 40, y: 150, width: 100, height: 40 },
    });
    expect(island.hasAttribute("data-island-handoff")).toBe(false);
  });

  it("sends nothing for an island on a page that isn't showing, and measures it again on stage", async () => {
    const view = renderNative(<Card />);
    await view.nextFrame();
    view.ackAll();
    await view.nextFrame();
    const card = view.container.querySelector("#card") as HTMLElement;
    const button = view.container.querySelector("button") as HTMLElement;
    act(() => {
      card.setAttribute("inert", "");
    });
    for (let frame = 0; frame < 4; frame += 1) await view.nextFrame();
    const before = view.operations().length;
    button.dataset.rect = rectAttribute(40, 150, 100, 40);
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    await view.nextFrame();
    expect(view.operations().slice(before)).toEqual([]);
    act(() => {
      card.removeAttribute("inert");
    });
    await view.nextFrame();
    expect(view.operations().slice(before).at(-1)).toMatchObject({
      op: "update",
      frame: { x: 40, y: 150, width: 100, height: 40 },
    });
  });

  it("keeps an island in a rotated, faded box native, turned and faded like it", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "transform"] });
    const view = renderNative(<Card />);
    const card = view.container.querySelector("#card") as HTMLElement;
    const button = view.container.querySelector("button") as HTMLElement;
    Object.defineProperty(button, "offsetWidth", { value: 90, configurable: true });
    Object.defineProperty(button, "offsetHeight", { value: 30, configurable: true });
    overrideStyle(card, { rotate: "90deg", opacity: "0.5" });
    view.rerender(<Card />);
    await view.nextFrame();
    const mount = view.operations()[0] as Record<string, unknown>;
    expect(mount).toMatchObject({
      op: "mount",
      visible: true,
      opacity: 0.5,
      frame: {
        x: expect.closeTo(40, 6),
        y: expect.closeTo(120, 6),
        width: expect.closeTo(40, 6),
        height: expect.closeTo(100, 6),
      },
    });
    const transform = mount.transform as Record<string, number>;
    expect(Math.round(transform.a as number)).toBe(0);
    expect(Math.round(transform.b as number)).toBe(1);
    view.ackAll();
    await view.nextFrame();
    overrideStyle(card, { rotate: "none", opacity: "1" });
    view.rerender(<Card />);
    await view.nextFrame();
    const last = view.operations().at(-1) as Record<string, unknown>;
    expect(last).toMatchObject({ op: "update", frame: { x: 10, y: 150, width: 100, height: 40 } });
    expect(last.transform).toBeUndefined();
    overrideStyle(card, { rotate: "45deg" });
    view.rerender(<Card />);
    await view.nextFrame();
    expect(view.operations().at(-1)).toMatchObject({
      op: "update",
      frame: { x: 15, y: 155, width: 90, height: 30 },
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
    const card = view.container.querySelector("#card") as HTMLElement;
    overrideStyle(card, { opacity: "0.5" });
    act(() => {
      card.setAttribute("style", "opacity: 0.5");
    });
    await view.nextFrame();
    expect(island.dataset.islandHandoff).toBe("faded");
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

  it("mounts an island on a page that is still entering, so it slides in natively", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "layered"] });
    const view = renderNative(
      <div data-island-phase="enter" id="stage" inert>
        <Route />
      </div>,
    );
    scrolling(view);
    view.rerender(
      <div data-island-phase="enter" id="stage" inert>
        <Route />
      </div>,
    );
    await view.nextFrame();
    expect(view.operations()).toEqual([
      expect.objectContaining({
        op: "mount",
        visible: true,
        anchor: expect.objectContaining({ type: "scroller" }),
      }),
    ]);
  });

  it("still waits for content moving inside its scroller", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "layered"] });
    const Inner = () => (
      <div id="route" data-rect={rectAttribute(0, 0, 400, 600)}>
        <div data-island-phase="enter" id="panel">
          <Card />
        </div>
      </div>
    );
    const view = renderNative(<Inner />);
    scrolling(view);
    view.rerender(<Inner />);
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    act(() => {
      (view.container.querySelector("#panel") as HTMLElement).removeAttribute("data-island-phase");
    });
    await view.nextFrame();
    expect(view.operations()).toEqual([expect.objectContaining({ op: "mount" })]);
  });
});

const Page = ({ open = 30 }: { open?: number }) => (
  <div id="route" data-rect={rectAttribute(0, 0, 400, 600)}>
    <div id="expander" data-rect={rectAttribute(0, 100, 400, open)}>
      <GlassButton title="Inside" islandId="inside">
        <button type="button" data-rect={rectAttribute(10, 110, 100, 40)}>
          Inside
        </button>
      </GlassButton>
    </div>
    <div
      id="footer"
      style={{ position: "sticky", bottom: 12 }}
      data-rect={rectAttribute(0, 520, 400, 60)}
    >
      <GlassButton title="Start" islandId="start">
        <button type="button" data-rect={rectAttribute(10, 528, 380, 44)}>
          Start
        </button>
      </GlassButton>
    </div>
  </div>
);

const prepare = (view: ReturnType<typeof renderNative>, open = 30) => {
  const route = view.container.querySelector("#route") as HTMLElement;
  const expander = view.container.querySelector("#expander") as HTMLElement;
  overrideStyle(route, { overflowY: "auto" });
  overrideStyle(expander, { overflowY: "hidden", overflowX: "hidden" });
  setScrollGeometry(route, { scrollHeight: 1200, clientHeight: 600, clientWidth: 400 });
  setScrollGeometry(expander, { clientHeight: open, clientWidth: 400 });
  return { route, expander };
};

describe("sticky and clipped islands", () => {
  const FEATURES = [...CAPABILITY.features, "layered", "sticky", "clip"];

  it("anchors a sticky footer in its page, so the host keeps it stuck and it rides page changes", async () => {
    installCapability({ ...CAPABILITY, features: FEATURES });
    const view = renderNative(<Page />);
    prepare(view);
    view.rerender(<Page />);
    await view.nextFrame();
    expect(view.operations()).toContainEqual(
      expect.objectContaining({
        op: "mount",
        id: "start",
        anchor: expect.objectContaining({ type: "scroller" }),
        sticky: expect.objectContaining({ bottom: 12 }),
      }),
    );
  });

  it("follows a sticky footer from JS on a host that cannot keep it stuck", async () => {
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "layered"] });
    const view = renderNative(<Page />);
    prepare(view);
    view.rerender(<Page />);
    await view.nextFrame();
    const start = view.operations().find((operation) => operation.id === "start");
    expect(start).toMatchObject({ op: "mount", anchor: { type: "screen" } });
    expect(start).not.toHaveProperty("sticky");
  });

  it("cuts what covers an island out of it and lays a backdrop over it as a shade", async () => {
    installCapability({ ...CAPABILITY, features: FEATURES });
    const view = renderNative(<Page open={60} />);
    const { route } = prepare(view, 60);
    const button = view.container.querySelector("#expander button") as HTMLElement;
    const toast = document.createElement("div");
    toast.dataset.rect = rectAttribute(0, 100, 40, 60);
    const veil = document.createElement("div");
    veil.dataset.rect = rectAttribute(0, 0, 400, 600);
    overrideStyle(veil, { backgroundColor: "rgba(0, 0, 0, 0.4)" });
    route.append(toast, veil);
    Object.assign(document, {
      elementsFromPoint: (x: number) => (x < 40 ? [toast, button] : [veil, button]),
    });
    view.rerender(<Page open={60} />);
    await view.nextFrame();
    expect(view.operations()).toContainEqual(
      expect.objectContaining({
        op: "mount",
        id: "inside",
        holes: [{ x: 0, y: 0, width: 30, height: 40 }],
        shades: [{ x: 0, y: 0, width: 100, height: 40, color: "rgba(0, 0, 0, 0.4)" }],
      }),
    );
  });

  it("keeps an island in an opening accordion native, cut to what is open so far", async () => {
    installCapability({ ...CAPABILITY, features: FEATURES });
    const view = renderNative(<Page />);
    const { expander } = prepare(view);
    transition("transitionrun", expander, "max-height");
    view.rerender(<Page />);
    await view.nextFrame();
    expect(view.operations()).toContainEqual(
      expect.objectContaining({
        op: "mount",
        id: "inside",
        visible: true,
        clip: { x: 0, y: 0, width: 100, height: 20 },
      }),
    );
    view.ackAll();
    transition("transitionrun", expander, "max-height");
    act(() => {
      expander.dataset.rect = rectAttribute(0, 100, 400, 60);
      setScrollGeometry(expander, { clientHeight: 60 });
    });
    await view.nextFrame();
    await view.nextFrame();
    const updates = view
      .operations()
      .filter((operation) => operation.id === "inside" && operation.op === "update");
    expect(updates).not.toContainEqual(expect.objectContaining({ visible: false }));
    expect(updates.at(-1)).toMatchObject({ frame: { x: 10, y: 110, width: 100, height: 40 } });
    expect(updates.at(-1)).not.toHaveProperty("clip");
  });
});
