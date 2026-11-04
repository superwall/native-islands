import { act, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Native } from "../../../src/react";
import { REUSE_GRACE_MS } from "../../../src/react/hooks/useNativeIsland";
import { GlassButton, Toggle } from "../../support/components";
import {
  CAPABILITY,
  installCapability,
  islandOf,
  mockLayout,
  rectAttribute,
  removeCapability,
  renderNative,
} from "../../support/react";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockLayout();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

const Cta = (props: { title?: string; onPress?: () => void; native?: boolean }) => (
  <GlassButton
    title={props.title ?? "Continue"}
    prominence="prominent"
    onPress={props.onPress}
    native={props.native}
  >
    <button type="button" data-rect={rectAttribute(24, 700, 354, 52)}>
      {props.title ?? "Continue"}
    </button>
  </GlassButton>
);

describe("<Native> without a native host", () => {
  it("renders only the web children and sends nothing", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(view.batches()).toEqual([]);
    expect(islandOf(view.container).dataset.islandMode).toBe("web");
    expect(islandOf(view.container).style.display).toBe("contents");
    expect(warn).not.toHaveBeenCalled();
  });

  it("can sit inside a paragraph without invalid HTML", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = renderNative(
      <p>
        Questions? <Cta /> We answer within a day.
      </p>,
    );
    await view.nextFrame();
    expect(islandOf(view.container).tagName).toBe("SPAN");
    expect(error).not.toHaveBeenCalled();
  });

  it("treats a malformed capability as no native host", async () => {
    installCapability({ protocol: "one" });
    const view = renderNative(<Cta />);
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });
});

describe("<Native> on a native host", () => {
  beforeEach(() => installCapability());

  it("mounts the island at the children's page frame with resolved props and accessibility", async () => {
    window.scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    const view = renderNative(<Cta />);
    await view.nextFrame();
    expect(view.operations()).toEqual([
      {
        op: "mount",
        id: expect.stringMatching(/^glassButton/),
        component: "glassButton",
        version: 1,
        props: { title: "Continue", prominence: "prominent" },
        frame: { x: 24, y: 800, width: 354, height: 52 },
        anchor: { type: "page" },
        visible: true,
        order: expect.any(Number),
        sizing: "web",
        accessibility: { label: "Continue", traits: ["button"] },
      },
    ]);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("keeps the web version visible until the host acknowledges, then hides it", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    const island = islandOf(view.container);
    expect(island.dataset.islandMode).toBe("pending");
    expect(island.hasAttribute("data-island-shown")).toBe(false);
    view.ackAll();
    expect(island.dataset.islandMode).toBe("native");
    expect(island.hasAttribute("data-island-shown")).toBe(true);
    expect(island.hasAttribute("aria-hidden")).toBe(false);
  });

  it("keeps the web version and hides the native view while the host has not answered, then recovers", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    await waitFor(
      () =>
        expect(warn).toHaveBeenCalledWith(
          "<glassButton> is showing its web version: timeout (the host has not answered yet; it switches to native if it does).",
        ),
      { timeout: 1500 },
    );
    expect(islandOf(view.container).dataset.islandMode).toBe("pending");
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(false);
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id: expect.any(String),
      visible: false,
    });
    view.ackAll();
    expect(islandOf(view.container).dataset.islandMode).toBe("native");
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id: expect.any(String),
      visible: true,
    });
  });

  it("shows the web version while the host re-mounts after a reset", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    view.ackAll();
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(true);
    view.send({ event_name: "native_component_reset" });
    expect(islandOf(view.container).dataset.islandMode).toBe("pending");
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(false);
    await view.nextFrame();
    expect(view.operations().at(-1)).toMatchObject({ op: "mount", visible: true });
    view.ackAll();
    expect(islandOf(view.container).dataset.islandMode).toBe("native");
  });

  it("shows the web version again when the host reports an error, with its message", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    view.ackAll();
    const id = view.operations()[0]?.id as string;
    view.send({
      event_name: "native_component_error",
      id,
      reason: "anchor_not_found",
      message: "no scroll view",
    });
    expect(islandOf(view.container).dataset.islandMode).toBe("web");
    expect(islandOf(view.container).hasAttribute("data-island-shown")).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "<glassButton> is showing its web version: anchor_not_found (no scroll view).",
    );
  });

  it("refuses a component the app did not register, loudly", async () => {
    const view = renderNative(
      <Native component="slider">
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("<slider> is showing its web version: unknown_component.");
  });

  it("refuses a component registered at an older version", async () => {
    const view = renderNative(
      <Native component="custom" version={3}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("<custom> is showing its web version: unsupported_version.");
  });

  it("refuses a duplicate island id and keeps the first island", async () => {
    const view = renderNative(
      <>
        <Native component="custom" version={2} islandId="same">
          <span data-rect={rectAttribute(0, 0, 10, 10)}>one</span>
        </Native>
        <Native component="custom" version={2} islandId="same">
          <span data-rect={rectAttribute(0, 20, 10, 10)}>two</span>
        </Native>
      </>,
    );
    await view.nextFrame();
    expect(view.operations()).toEqual([
      expect.objectContaining({
        op: "mount",
        id: "same",
        frame: expect.objectContaining({ y: 0 }),
      }),
    ]);
    expect(warn).toHaveBeenCalledWith("<custom> is showing its web version: duplicate_id.");
  });

  it("refuses props that cannot reach native", async () => {
    const view = renderNative(
      <Native component="custom" version={2} props={{ when: new Date() as never }}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("<custom> is showing its web version: invalid_spec.");
  });

  it("does not mount an island with nothing to measure", async () => {
    const view = renderNative(<Native component="custom" version={2} />);
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });

  it("sends empty accessibility when there is nothing to read, so a stale label is cleared", async () => {
    const view = renderNative(
      <Native component="custom" version={2}>
        <div data-rect={rectAttribute(0, 0, 10, 10)} />
      </Native>,
    );
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({ accessibility: {} });
  });

  it("does not mount when native is turned off", async () => {
    const view = renderNative(<Cta native={false} />);
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });

  it("routes native events to the matching handler", async () => {
    const onPress = vi.fn();
    const view = renderNative(<Cta onPress={onPress} />);
    await view.nextFrame();
    view.ackAll();
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_event", id, name: "press" });
    view.send({ event_name: "native_component_event", id, name: "longPress" });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the latest handler after a re-render", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderNative(<Cta onPress={first} />);
    await view.nextFrame();
    view.ackAll();
    view.rerender(<Cta onPress={second} />);
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_event", id, name: "press" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("passes every event to a generic onEvent", async () => {
    const onEvent = vi.fn();
    const view = renderNative(
      <Native component="custom" version={2} onEvent={onEvent}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    view.ackAll();
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_event", id, name: "scrub", payload: 0.5 });
    expect(onEvent).toHaveBeenCalledWith("scrub", 0.5);
  });

  it("ignores events when no handler is given", async () => {
    const view = renderNative(
      <Native component="custom" version={2}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_event", id, name: "press" });
    expect(islandOf(view.container, "custom")).toBeTruthy();
  });

  it("sends changed props as an update", async () => {
    const view = renderNative(<Cta title="Continue" />);
    await view.nextFrame();
    view.ackAll();
    view.rerender(<Cta title="Start trial" />);
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id: expect.any(String),
      props: { title: "Start trial", prominence: "prominent" },
      accessibility: { label: "Start trial", traits: ["button"] },
    });
  });

  it("unmounts the island with the component", async () => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    view.ackAll();
    view.unmount();
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({ op: "unmount", id: expect.any(String) });
  });

  it("re-measures when the children resize", async () => {
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const view = renderNative(<Cta />);
    await view.nextFrame();
    view.ackAll();
    const button = screen.getByRole("button", { hidden: true });
    button.dataset.rect = rectAttribute(24, 700, 354, 80);
    act(() => observers.forEach((callback) => callback()));
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id: expect.any(String),
      frame: { x: 24, y: 700, width: 354, height: 80 },
    });
    vi.unstubAllGlobals();
  });

  it("skips re-measuring when the children are gone", async () => {
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const view = renderNative(
      <Native component="custom" version={2}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    view.ackAll();
    const island = islandOf(view.container, "custom");
    const before = view.operations().length;
    island.replaceChildren();
    act(() => observers.forEach((callback) => callback()));
    await view.nextFrame();
    expect(view.operations()).toHaveLength(before);
    vi.unstubAllGlobals();
  });

  it("skips the per-render update when the children are gone", async () => {
    const view = renderNative(<Cta title="A" />);
    await view.nextFrame();
    view.ackAll();
    const before = view.operations().length;
    islandOf(view.container).replaceChildren();
    view.rerender(<Cta title="B" />);
    await view.nextFrame();
    expect(view.operations()).toHaveLength(before);
  });
});

describe("native sizing", () => {
  beforeEach(() => installCapability());

  it("takes the size the native view reports", async () => {
    const view = renderNative(
      <Toggle isOn onChange={() => undefined}>
        <input
          type="checkbox"
          role="switch"
          aria-label="Annual"
          data-rect={rectAttribute(0, 0, 40, 20)}
        />
      </Toggle>,
    );
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({
      sizing: "native",
      accessibility: { label: "Annual", traits: ["switch"] },
    });
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_size", id, size: { width: 51, height: 31 } });
    view.send({ event_name: "native_component_size", id, size: { width: 51, height: 31 } });
    const island = islandOf(view.container, "toggle");
    expect(island.style.display).toBe("inline-block");
    expect(island.style.width).toBe("51px");
    expect(island.style.height).toBe("31px");
    view.send({ event_name: "native_component_ack", sequence: 1, ids: [id] });
    expect(island.dataset.islandMode).toBe("native");
    expect(island.style.width).toBe("51px");
  });

  it("moves the island when the native view reports a new size", async () => {
    // A trailing-aligned row 300 wide: the island's box ends at x 300, so
    // its x follows its width, as WebKit would lay it out.
    const layout = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
    const measured = layout.getMockImplementation() as (this: HTMLElement) => DOMRect;
    layout.mockImplementation(function (this: HTMLElement) {
      if (this.dataset.island !== "toggle" || this.style.display !== "inline-block") {
        return measured.call(this);
      }
      const width = Number.parseFloat(this.style.width);
      const height = Number.parseFloat(this.style.height);
      this.dataset.rect = rectAttribute(300 - width, 0, width, height);
      return measured.call(this);
    });
    const view = renderNative(
      <Toggle isOn onChange={() => undefined}>
        <input type="checkbox" data-rect={rectAttribute(280, 0, 20, 20)} />
      </Toggle>,
    );
    await view.nextFrame();
    const id = view.operations()[0]?.id as string;
    view.send({ event_name: "native_component_size", id, size: { width: 20, height: 20 } });
    view.send({ event_name: "native_component_ack", sequence: 1, ids: [id] });
    await view.nextFrame();
    const island = islandOf(view.container, "toggle");
    expect(island.style.width).toBe("20px");
    view.send({ event_name: "native_component_size", id, size: { width: 80, height: 20 } });
    expect(island.style.width).toBe("80px");
    await view.nextFrame();
    expect(view.operations().at(-1)).toEqual({
      op: "update",
      id,
      frame: { x: 220, y: 0, width: 80, height: 20 },
    });
  });

  it("routes change events with their payload", async () => {
    const onChange = vi.fn();
    const view = renderNative(
      <Toggle isOn={false} onChange={onChange}>
        <input type="checkbox" data-rect={rectAttribute(0, 0, 40, 20)} />
      </Toggle>,
    );
    await view.nextFrame();
    view.ackAll();
    const id = view.operations()[0]?.id as string;
    view.send({
      event_name: "native_component_event",
      id,
      name: "change",
      payload: { isOn: true },
    });
    expect(onChange).toHaveBeenCalledWith({ isOn: true });
  });
});

describe("<Native> with an explicit accessibility", () => {
  beforeEach(() => installCapability());

  it("overrides what is derived from the children", async () => {
    const view = renderNative(
      <Native
        component="custom"
        version={2}
        accessibility={{ label: "Buy", hint: "Opens checkout" }}
      >
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({
      accessibility: { label: "Buy", hint: "Opens checkout" },
    });
  });
});

describe("React.StrictMode", () => {
  beforeEach(() => installCapability());

  it("survives the double mount with one live island", async () => {
    const view = renderNative(
      <React.StrictMode>
        <Cta />
      </React.StrictMode>,
    );
    await view.nextFrame();
    const mounts = view.operations().filter((operation) => operation.op === "mount");
    expect(mounts).toHaveLength(1);
    view.ackAll();
    expect(islandOf(view.container).dataset.islandMode).toBe("native");
  });
});

describe("<Native> coming back where the host kept its view", () => {
  beforeEach(() =>
    installCapability({ ...CAPABILITY, features: [...CAPABILITY.features, "reuse"] }),
  );

  const leaveAndReturn = async (returning: React.ReactElement) => {
    const view = renderNative(<Cta />);
    await view.nextFrame();
    view.ackAll();
    view.rerender(<></>);
    await view.nextFrame();
    const before = view.operations().length;
    view.rerender(returning);
    return { view, before };
  };

  it("keeps the web version up, asks the host for the kept view at once, then swaps without a fade", async () => {
    const { view, before } = await leaveAndReturn(<Cta />);
    const island = islandOf(view.container);
    expect(island.dataset.islandMode).toBe("pending");
    expect(island.hasAttribute("data-island-reusing")).toBe(true);
    expect(island.hasAttribute("data-island-shown")).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.operations().slice(before)).toEqual([
      expect.objectContaining({ op: "mount", reuse: expect.any(String) }),
    ]);
    view.ackAll();
    expect(island.hasAttribute("data-island-reusing")).toBe(true);
    expect(island.hasAttribute("data-island-shown")).toBe(true);
  });

  it("fades as usual when the host takes longer than the grace period", async () => {
    const { view } = await leaveAndReturn(<Cta />);
    const island = islandOf(view.container);
    await waitFor(() => expect(island.hasAttribute("data-island-reusing")).toBe(false), {
      timeout: REUSE_GRACE_MS * 3,
    });
    expect(island.dataset.islandMode).toBe("pending");
    expect(island.hasAttribute("data-island-shown")).toBe(false);
  });

  it("shows the web version at once when the host fails the island", async () => {
    const { view } = await leaveAndReturn(<Cta />);
    await act(async () => {
      await Promise.resolve();
    });
    const mount = view.operations().at(-1);
    const sequence = view.batches().at(-1)?.sequence ?? 0;
    view.send({
      event_name: "native_component_error",
      id: mount?.id ?? "",
      reason: "render_failed",
      sequence,
    });
    const island = islandOf(view.container);
    expect(island.dataset.islandMode).toBe("web");
    expect(island.hasAttribute("data-island-reusing")).toBe(false);
  });

  it("takes over nothing for an island that mounts once its page has come on stage", async () => {
    const Entering = ({ phase }: { phase?: string }) => (
      <div id="panel" data-island-phase={phase}>
        <Cta />
      </div>
    );
    const { view, before } = await leaveAndReturn(<Entering phase="enter" />);
    await view.nextFrame();
    expect(view.operations().slice(before)).toEqual([]);
    view.rerender(<Entering />);
    await view.nextFrame();
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-reusing")).toBe(false);
    expect(view.operations().slice(before)).toEqual([expect.objectContaining({ op: "mount" })]);
    expect(view.operations().at(-1)).not.toHaveProperty("reuse");
  });

  it("waits for the next layout pass, as before, when the host kept nothing like it", async () => {
    const { view, before } = await leaveAndReturn(<Cta title="Other" />);
    const island = islandOf(view.container);
    expect(island.hasAttribute("data-island-reusing")).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.operations().slice(before)).toEqual([]);
    await view.nextFrame();
    expect(view.operations().slice(before)).toEqual([
      expect.objectContaining({ op: "mount", props: expect.objectContaining({ title: "Other" }) }),
    ]);
    expect(view.operations().at(-1)).not.toHaveProperty("reuse");
  });
});
