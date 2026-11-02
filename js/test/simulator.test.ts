import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TToPageMessage, TNativeOperation } from "../src";
import {
  installNativeSimulator,
  SIMULATED_COMPONENTS,
  type NativeSimulator,
} from "../src/simulator-entry";
import {
  mockLayout,
  overrideStyle,
  rectAttribute,
  resetStyleOverrides,
  setScrollGeometry,
} from "./dom";

type Global = Window & {
  __NATIVE_ISLANDS__?: unknown;
  webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
  __nativeIslands?: { accept: (messages: unknown) => void; accept64: (encoded: string) => void };
};

const global = window as Global;
let simulator: NativeSimulator | undefined;
let received: TToPageMessage[];

beforeEach(() => {
  vi.useFakeTimers();
  mockLayout();
  received = [];
  global.__nativeIslands = {
    accept: (messages) => received.push(...(messages as TToPageMessage[])),
    accept64: () => undefined,
  };
});

afterEach(() => {
  simulator?.uninstall();
  simulator = undefined;
  delete global.__nativeIslands;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetStyleOverrides();
});

let sequence = 0;

const post = (operations: TNativeOperation[]) => {
  sequence += 1;
  global.webkit?.messageHandlers?.nativeIslands?.postMessage({
    event_name: "native_component_batch",
    protocol: 1,
    sequence,
    operations,
  });
  vi.advanceTimersByTime(0);
  return sequence;
};

const mount = (overrides: Partial<Extract<TNativeOperation, { op: "mount" }>> = {}) =>
  ({
    op: "mount",
    id: "cta",
    component: "glassButton",
    version: 1,
    props: { title: "Go" },
    frame: { x: 10, y: 20, width: 100, height: 44 },
    anchor: { type: "page" },
    visible: true,
    order: 0,
    sizing: "web",
    ...overrides,
  }) as TNativeOperation;

const drawn = (id = "cta") =>
  document.querySelector(`[data-island-simulated="${id}"]`) as HTMLElement;

describe("installNativeSimulator", () => {
  it("advertises every built-in and refuses to run beside a real host", () => {
    simulator = installNativeSimulator();
    expect(global.__NATIVE_ISLANDS__).toEqual({
      protocol: 1,
      components: SIMULATED_COMPONENTS,
      anchors: ["page", "scroller", "screen"],
      features: ["state", "requests", "commands", "layered"],
    });
    expect(() => installNativeSimulator()).toThrow(/already present/);
  });

  it("restores the window on uninstall", () => {
    global.webkit = { messageHandlers: { other: { postMessage: () => undefined } } };
    simulator = installNativeSimulator({ components: { custom: 2 } });
    expect(global.__NATIVE_ISLANDS__).toMatchObject({ components: { custom: 2 } });
    simulator.uninstall();
    simulator = undefined;
    expect(global.__NATIVE_ISLANDS__).toBeUndefined();
    expect(Object.keys(global.webkit?.messageHandlers ?? {})).toEqual(["other"]);
    expect(document.querySelectorAll("[data-island-simulator-layer]")).toHaveLength(0);
    delete global.webkit;
  });

  it("draws a page island at its frame, labelled, and acknowledges it", () => {
    simulator = installNativeSimulator();
    const batch = post([mount()]);
    expect(drawn().parentElement?.dataset.islandSimulatorLayer).toBe("absolute");
    expect(drawn().style.left).toBe("10px");
    expect(drawn().style.height).toBe("44px");
    expect(drawn().textContent).toBe("glassButton · Go");
    expect(received).toEqual([
      { event_name: "native_component_ack", sequence: batch, ids: ["cta"] },
    ]);
    expect(simulator.islands()).toMatchObject([{ id: "cta", anchor: "page", visible: true }]);
  });

  it("draws a screen island in the fixed layer, hidden when mounted hidden", () => {
    simulator = installNativeSimulator();
    post([
      mount({
        anchor: { type: "screen" },
        visible: false,
        props: { name: "crown" },
        component: "symbol",
      }),
    ]);
    expect(drawn().parentElement?.dataset.islandSimulatorLayer).toBe("fixed");
    expect(drawn().style.opacity).toBe("0");
    expect(drawn().textContent).toBe("symbol · crown");
  });

  it("draws a scroller island inside the matching scroller, positioning a static one", () => {
    const list = document.createElement("div");
    list.dataset.rect = rectAttribute(0, 100, 400, 300);
    document.body.appendChild(list);
    overrideStyle(list, { overflowY: "auto", position: "static" });
    setScrollGeometry(list, {
      scrollHeight: 900,
      scrollWidth: 400,
      clientHeight: 300,
      clientWidth: 400,
    });
    simulator = installNativeSimulator();
    post([
      mount({
        props: {},
        anchor: {
          type: "scroller",
          scroller: {
            id: "s",
            frame: { x: 0.5, y: 100, width: 400, height: 300 },
            content_size: { width: 400, height: 900 },
            scroll_offset: { x: 0, y: 0 },
          },
        },
      }),
    ]);
    expect(drawn().parentElement).toBe(list);
    expect(list.style.position).toBe("relative");
    expect(drawn().textContent).toBe("glassButton");
  });

  it("draws inside an RTL scroller from its left content edge, and restores it on uninstall", () => {
    const list = document.createElement("div");
    list.dataset.rect = rectAttribute(0, 100, 282, 100);
    list.style.position = "";
    document.body.appendChild(list);
    overrideStyle(list, { overflowX: "auto", position: "static", direction: "rtl" });
    setScrollGeometry(list, {
      scrollLeft: -100,
      scrollWidth: 860,
      clientWidth: 282,
      scrollHeight: 100,
      clientHeight: 100,
    });
    simulator = installNativeSimulator();
    post([
      mount({
        frame: { x: 660, y: 10, width: 80, height: 30 },
        anchor: {
          type: "scroller",
          scroller: {
            id: "s",
            frame: { x: 0, y: 100, width: 282, height: 100 },
            content_size: { width: 860, height: 100 },
            scroll_offset: { x: 478, y: 0 },
          },
        },
      }),
    ]);
    expect(drawn().parentElement).toBe(list);
    expect(drawn().style.left).toBe("82px");
    simulator.press("cta");
    vi.advanceTimersByTime(0);
    expect(received.at(-1)).toMatchObject({ name: "press", sequence: expect.any(Number) });
    simulator.uninstall();
    simulator = undefined;
    expect(list.querySelector("[data-island-simulated]")).toBeNull();
    expect(list.style.position).toBe("");
  });

  it("leaves a positioned scroller alone", () => {
    const list = document.createElement("div");
    list.dataset.rect = rectAttribute(0, 0, 200, 200);
    document.body.appendChild(list);
    overrideStyle(list, { overflowY: "auto", position: "absolute" });
    setScrollGeometry(list, {
      scrollHeight: 900,
      scrollWidth: 200,
      clientHeight: 200,
      clientWidth: 200,
    });
    simulator = installNativeSimulator();
    const scroller = {
      id: "s",
      frame: { x: 0, y: 0, width: 200, height: 200 },
      content_size: { width: 200, height: 900 },
      scroll_offset: { x: 0, y: 0 },
    };
    post([mount({ anchor: { type: "scroller", scroller } })]);
    expect(list.style.position).toBe("");
    expect(drawn().parentElement).toBe(list);
  });

  it("tells apart scrollers stacked on the same frame by their content, as during a page push", () => {
    const behind = document.createElement("div");
    const active = document.createElement("div");
    for (const [element, height] of [
      [behind, 1200],
      [active, 1800],
    ] as const) {
      element.dataset.rect = rectAttribute(0, 0, 400, 800);
      document.body.appendChild(element);
      overrideStyle(element, { overflowY: "auto", position: "absolute" });
      setScrollGeometry(element, {
        scrollHeight: height,
        scrollWidth: 400,
        clientHeight: 800,
        clientWidth: 400,
      });
    }
    simulator = installNativeSimulator();
    post([
      mount({
        anchor: {
          type: "scroller",
          scroller: {
            id: "s",
            frame: { x: 0, y: 0, width: 400, height: 800 },
            content_size: { width: 400, height: 1800 },
            scroll_offset: { x: 0, y: 0 },
          },
        },
      }),
    ]);
    expect(drawn().parentElement).toBe(active);
  });

  it("picks the nearest of identical scrollers, and tolerates a scroller that moved since it was measured", () => {
    const lists = [0, 300].map((y) => {
      const list = document.createElement("div");
      list.dataset.rect = rectAttribute(0, y, 400, 200);
      document.body.appendChild(list);
      overrideStyle(list, { overflowY: "auto", position: "absolute" });
      setScrollGeometry(list, {
        scrollHeight: 600,
        scrollWidth: 400,
        clientHeight: 200,
        clientWidth: 400,
      });
      return list;
    });
    simulator = installNativeSimulator();
    const anchor = (y: number) => ({
      type: "scroller" as const,
      scroller: {
        id: "s",
        frame: { x: 0, y, width: 400, height: 200 },
        content_size: { width: 400, height: 600 },
        scroll_offset: { x: 0, y: 0 },
      },
    });
    post([mount({ id: "low", anchor: anchor(290) }), mount({ id: "high", anchor: anchor(-40) })]);
    expect(drawn("low").parentElement).toBe(lists[1]);
    expect(drawn("high").parentElement).toBe(lists[0]);
  });

  it("reports a scroller it cannot find", () => {
    simulator = installNativeSimulator();
    post([
      mount({
        anchor: {
          type: "scroller",
          scroller: {
            id: "s",
            frame: { x: 0, y: 0, width: 10, height: 10 },
            content_size: { width: 10, height: 20 },
            scroll_offset: { x: 0, y: 0 },
          },
        },
      }),
    ]);
    expect(received).toEqual([
      {
        event_name: "native_component_error",
        id: "cta",
        reason: "anchor_not_found",
        sequence: expect.any(Number),
      },
    ]);
  });

  it("refuses unknown, outdated and failing components, and never answers silent ones", () => {
    simulator = installNativeSimulator({
      components: { a: 1, b: 1, c: 1 },
      failing: ["b"],
      silent: ["c"],
    });
    post([
      mount({ id: "x", component: "nope" }),
      mount({ id: "y", component: "a", version: 2 }),
      mount({ id: "z", component: "b" }),
      mount({ id: "w", component: "c" }),
    ]);
    expect(received).toEqual([
      {
        event_name: "native_component_error",
        id: "x",
        reason: "unknown_component",
        sequence: expect.any(Number),
      },
      {
        event_name: "native_component_error",
        id: "y",
        reason: "unsupported_version",
        sequence: expect.any(Number),
      },
      {
        event_name: "native_component_error",
        id: "z",
        reason: "render_failed",
        sequence: expect.any(Number),
      },
    ]);
    expect(drawn("w")).toBeTruthy();
  });

  it("reports the native size of a natively sized component", () => {
    simulator = installNativeSimulator({ sizes: { glassButton: { width: 80, height: 40 } } });
    post([mount({ component: "toggle", sizing: "native" }), mount({ id: "b", sizing: "native" })]);
    expect(received).toContainEqual({
      event_name: "native_component_size",
      id: "cta",
      size: { width: 51, height: 31 },
      sequence: expect.any(Number),
    });
    expect(received).toContainEqual({
      event_name: "native_component_size",
      id: "b",
      size: { width: 80, height: 40 },
      sequence: expect.any(Number),
    });
  });

  it("applies updates, re-anchors, and replaces a re-mounted id", () => {
    simulator = installNativeSimulator();
    post([mount()]);
    post([
      {
        op: "update",
        id: "cta",
        frame: { x: 1, y: 2, width: 3, height: 4 },
        props: { title: "B" },
        visible: false,
      },
    ]);
    expect(drawn().style.left).toBe("1px");
    expect(drawn().textContent).toBe("glassButton · B");
    expect(drawn().style.opacity).toBe("0");
    post([{ op: "update", id: "cta", anchor: { type: "screen" } }]);
    expect(drawn().parentElement?.dataset.islandSimulatorLayer).toBe("fixed");
    expect(simulator.islands()[0]?.anchor).toBe("screen");
    post([{ op: "update", id: "cta", order: 2 }]);
    post([{ op: "update", id: "ghost", visible: true }]);
    post([mount({ props: { title: "Again" } })]);
    expect(document.querySelectorAll("[data-island-simulated]")).toHaveLength(1);
    expect(drawn().textContent).toBe("glassButton · Again");
  });

  it("drops an island whose new scroller cannot be found", () => {
    simulator = installNativeSimulator();
    post([mount()]);
    received = [];
    post([
      {
        op: "update",
        id: "cta",
        anchor: {
          type: "scroller",
          scroller: {
            id: "s",
            frame: { x: 0, y: 0, width: 10, height: 10 },
            content_size: { width: 10, height: 20 },
            scroll_offset: { x: 0, y: 0 },
          },
        },
      },
    ]);
    expect(drawn()).toBeNull();
    expect(received).toEqual([
      {
        event_name: "native_component_error",
        id: "cta",
        reason: "anchor_not_found",
        sequence: expect.any(Number),
      },
    ]);
  });

  it("removes unmounted islands, takes JSON strings, and ignores what it cannot read", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    simulator = installNativeSimulator();
    post([mount()]);
    post([{ op: "unmount", id: "cta" }]);
    expect(drawn()).toBeNull();
    global.webkit?.messageHandlers?.nativeIslands?.postMessage({ not: "a message" });
    expect(warn).toHaveBeenCalledWith("The native simulator ignored a message it cannot read.", {
      not: "a message",
    });
    global.webkit?.messageHandlers?.nativeIslands?.postMessage(
      JSON.stringify({
        event_name: "native_component_batch",
        protocol: 1,
        sequence: 99,
        operations: [mount()],
      }),
    );
    expect(simulator.islands()).toHaveLength(1);
  });

  it("presses an island, with or without a payload, after the configured latency", () => {
    simulator = installNativeSimulator({ latencyMs: 30 });
    simulator.press("cta");
    simulator.press("toggle", "change", { isOn: true });
    vi.advanceTimersByTime(29);
    expect(received).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(received).toEqual([
      { event_name: "native_component_event", id: "cta", name: "press" },
      {
        event_name: "native_component_event",
        id: "toggle",
        name: "change",
        payload: { isOn: true },
      },
    ]);
  });

  it("delivers nothing before the page is listening", () => {
    delete global.__nativeIslands;
    simulator = installNativeSimulator();
    expect(() => post([mount()])).not.toThrow();
  });

  it("measures how far each drawn island sits from its web element", () => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    wrapper.dataset.islandId = "cta";
    wrapper.innerHTML = `<button data-rect="${rectAttribute(10, 20, 100, 44)}">Go</button>`;
    document.body.appendChild(wrapper);
    simulator = installNativeSimulator();
    post([mount(), mount({ id: "orphan" })]);
    drawn().dataset.rect = rectAttribute(10.25, 20, 100, 44.5);
    expect(simulator.alignment()).toEqual([
      { id: "cta", visible: true, dx: 0.25, dy: 0, dw: 0, dh: 0.5 },
    ]);
  });
});

const postRaw = (events: unknown[]) => {
  for (const event of events) global.webkit?.messageHandlers?.nativeIslands?.postMessage(event);
  vi.advanceTimersByTime(0);
};

describe("simulated state, requests and commands", () => {
  it("advertises the features", () => {
    simulator = installNativeSimulator();
    expect(global.__NATIVE_ISLANDS__).toMatchObject({
      features: ["state", "requests", "commands", "layered"],
    });
  });

  it("drops props that echo an older state than native already shows, as a real host must", () => {
    simulator = installNativeSimulator();
    post([mount({ props: { email: "" } })]);
    post([{ op: "update", id: "cta", props: { email: "" }, state_revision: 0 }]);
    expect(simulator.islands()[0]?.props).toEqual({ email: "" });
    simulator.setState("cta", { email: "a" });
    simulator.setState("cta", { email: "ab" });
    post([{ op: "update", id: "cta", props: { email: "a" }, state_revision: 1 }]);
    expect(simulator.islands()[0]?.props).toEqual({ email: "" });
    post([{ op: "update", id: "cta", props: { email: "ab" }, state_revision: 2 }]);
    expect(simulator.islands()[0]?.props).toEqual({ email: "ab" });
    post([{ op: "update", id: "cta", props: { email: "abc" } }]);
    expect(simulator.islands()[0]?.props).toEqual({ email: "abc" });
  });

  it("sends state with rising revisions per island, and starts again once it remounts", () => {
    simulator = installNativeSimulator();
    post([mount()]);
    expect(simulator.setState("cta", { email: "a" })).toBe(1);
    expect(simulator.setState("cta", { email: "b" }, true)).toBe(2);
    vi.advanceTimersByTime(0);
    const states = received.filter((message) => message.event_name === "native_component_state");
    expect(states).toEqual([
      {
        event_name: "native_component_state",
        id: "cta",
        revision: 1,
        values: { email: "a" },
        sequence: expect.any(Number),
      },
      {
        event_name: "native_component_state",
        id: "cta",
        revision: 2,
        values: { email: "b" },
        replace: true,
        sequence: expect.any(Number),
      },
    ]);
    post([{ op: "unmount", id: "cta" }]);
    post([mount()]);
    expect(simulator.setState("cta", {})).toBe(1);
    expect(simulator.setState("ghost", {})).toBe(1);
  });

  it("asks the page and resolves with its response, ignoring responses it did not ask for", async () => {
    simulator = installNativeSimulator();
    post([mount()]);
    const answer = simulator.request("cta", "validate", { email: "a@b.co" });
    const bare = simulator.request("ghost", "ping");
    vi.advanceTimersByTime(0);
    const asked = received.filter((message) => message.event_name === "native_component_request");
    expect(asked[0]).toMatchObject({ id: "cta", name: "validate", payload: { email: "a@b.co" } });
    expect(asked[1]).not.toHaveProperty("payload");
    expect(asked[1]).not.toHaveProperty("sequence");
    const [first, second] = asked as Array<
      Extract<TToPageMessage, { event_name: "native_component_request" }>
    >;
    postRaw([
      {
        event_name: "native_component_response",
        id: "cta",
        request_id: first?.request_id,
        ok: true,
        value: { valid: true },
      },
      {
        event_name: "native_component_response",
        id: "ghost",
        request_id: second?.request_id,
        ok: false,
        error: "nope",
      },
      { event_name: "native_component_response", id: "cta", request_id: "unknown", ok: true },
    ]);
    await expect(answer).resolves.toEqual({ ok: true, value: { valid: true } });
    await expect(bare).resolves.toEqual({ ok: false, error: "nope" });
  });

  it("answers commands through onCommand, refuses what it throws, and records every command", () => {
    simulator = installNativeSimulator({
      onCommand: (island, name) => {
        if (name === "explode") throw new Error("refused");
        if (name === "boom") throw "string";
        return name === "measure" ? island.id : undefined;
      },
    });
    post([mount()]);
    postRaw([
      { event_name: "native_component_command", id: "cta", request_id: "c1", name: "measure" },
      {
        event_name: "native_component_command",
        id: "cta",
        request_id: "c2",
        name: "focus",
        args: { at: 1 },
      },
      { event_name: "native_component_command", id: "cta", request_id: "c3", name: "explode" },
      { event_name: "native_component_command", id: "cta", request_id: "c4", name: "boom" },
      { event_name: "native_component_command", id: "ghost", request_id: "c5", name: "focus" },
    ]);
    vi.advanceTimersByTime(0);
    const replies = received.filter((message) => message.event_name === "native_component_reply");
    expect(replies).toEqual([
      { event_name: "native_component_reply", request_id: "c1", ok: true, value: "cta" },
      { event_name: "native_component_reply", request_id: "c2", ok: true },
      { event_name: "native_component_reply", request_id: "c3", ok: false, error: "refused" },
      { event_name: "native_component_reply", request_id: "c4", ok: false, error: "string" },
      {
        event_name: "native_component_reply",
        request_id: "c5",
        ok: false,
        error: "no island ghost",
      },
    ]);
    expect(simulator.commands()).toEqual([
      { id: "cta", name: "measure" },
      { id: "cta", name: "focus", args: { at: 1 } },
      { id: "cta", name: "explode" },
      { id: "cta", name: "boom" },
      { id: "ghost", name: "focus" },
    ]);
  });

  it("succeeds every command without onCommand", () => {
    simulator = installNativeSimulator();
    post([mount()]);
    postRaw([
      { event_name: "native_component_command", id: "cta", request_id: "c", name: "focus" },
    ]);
    vi.advanceTimersByTime(0);
    expect(received.filter((message) => message.event_name === "native_component_reply")).toEqual([
      { event_name: "native_component_reply", request_id: "c", ok: true },
    ]);
  });
});
