import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NativeComponentLimits,
  ToHostMessageSchema,
  type TToPageMessage,
  type TToHostMessage,
} from "../../src";
import {
  createNativeIslands,
  NATIVE_ACK_TIMEOUT_MS,
  NATIVE_FLUSH_FALLBACK_MS,
  readNativeCapability,
  toNativeProps,
  type NativeIslandListener,
  type NativeIslandSpec,
} from "../../src";

const capability = readNativeCapability({
  protocol: 1,
  components: { glassButton: 1, toggle: 2 },
});

const spec = (overrides: Partial<NativeIslandSpec> = {}): NativeIslandSpec => ({
  component: "glassButton",
  version: 1,
  props: { title: "Continue" },
  frame: { x: 10, y: 20, width: 100, height: 44 },
  anchor: { type: "page" },
  visible: true,
  order: 0,
  sizing: "web",
  ...overrides,
});

const setup = (options: { ackTimeoutMs?: number } = {}) => {
  const posted: TToHostMessage[] = [];
  const pending: Array<() => void> = [];
  const islands = createNativeIslands({
    capability,
    post: (message) => {
      expect(ToHostMessageSchema.safeParse(message).success).toBe(true);
      posted.push(message);
    },
    schedule: (flush) => pending.push(flush),
    ...options,
  });
  const frame = () => {
    for (const flush of pending.splice(0)) flush();
  };
  const batches = () =>
    posted.flatMap((message) => (message.event_name === "native_component_batch" ? [message] : []));
  const operations = () => batches().flatMap((batch) => batch.operations);
  const listener = (): Required<Omit<NativeIslandListener, "refresh">> => ({
    onReady: vi.fn(),
    onPending: vi.fn(),
    onStall: vi.fn(),
    onFallback: vi.fn(),
    onEvent: vi.fn(),
    onSize: vi.fn(),
    onState: vi.fn(),
    onRequest: vi.fn(),
  });
  const receive = (message: TToPageMessage) => islands.handle(message);
  return { islands, posted, pending, frame, batches, operations, listener, receive };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mount", () => {
  it("refuses components the capability does not list, before sending anything", () => {
    const { islands, pending } = setup();
    expect(islands.mount("a", spec({ component: "slider" }))).toEqual({
      ok: false,
      reason: "unknown_component",
    });
    expect(islands.mount("a", spec({ component: "toggle", version: 3 }))).toEqual({
      ok: false,
      reason: "unsupported_version",
    });
    expect(pending).toHaveLength(0);
  });

  it("refuses everything when the capability is absent or invalid", () => {
    for (const result of [readNativeCapability(undefined), readNativeCapability({ protocol: 1 })]) {
      const islands = createNativeIslands({ capability: result, post: vi.fn() });
      expect(islands.mount("a", spec())).toEqual({ ok: false, reason: "unavailable" });
      expect(islands.capability).toBe(result);
    }
  });

  it("refuses a duplicate id loudly instead of overwriting the first island", () => {
    const { islands, frame, operations } = setup();
    expect(islands.mount("a", spec())).toEqual({ ok: true });
    expect(islands.mount("a", spec({ props: { title: "Other" } }))).toEqual({
      ok: false,
      reason: "duplicate_id",
    });
    frame();
    expect(operations()).toHaveLength(1);
    expect(operations()[0]).toMatchObject({ op: "mount", props: { title: "Continue" } });
  });

  it("refuses props that cannot cross the bridge", () => {
    const { islands } = setup();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const props of [
      { onPress: () => undefined },
      { when: new Date() },
      { size: Number.NaN },
      { list: [1, Symbol("x")] },
      { nested: { deep: Number.POSITIVE_INFINITY } },
      circular,
    ]) {
      expect(islands.mount("a", spec({ props }))).toEqual({ ok: false, reason: "invalid_spec" });
    }
  });

  it("caps the number of live islands", () => {
    const { islands } = setup();
    for (let index = 0; index < NativeComponentLimits.maxIslands; index += 1) {
      expect(islands.mount(`island-${index}`, spec()).ok).toBe(true);
    }
    expect(islands.mount("one-more", spec())).toEqual({ ok: false, reason: "limit_exceeded" });
  });

  it("sends one mount per island in a single batch per frame, with accessibility only when set", () => {
    const { islands, frame, batches } = setup();
    islands.mount("a", spec());
    islands.mount("b", spec({ accessibility: { label: "Close" }, order: 1 }));
    expect(batches()).toHaveLength(0);
    frame();
    expect(batches()).toEqual([
      {
        event_name: "native_component_batch",
        protocol: 1,
        sequence: 1,
        operations: [
          {
            op: "mount",
            id: "a",
            component: "glassButton",
            version: 1,
            props: { title: "Continue" },
            frame: { x: 10, y: 20, width: 100, height: 44 },
            anchor: { type: "page" },
            visible: true,
            order: 0,
            sizing: "web",
          },
          expect.objectContaining({ id: "b", accessibility: { label: "Close" }, order: 1 }),
        ],
      },
    ]);
    expect(islands.status("a")).toBe("pending");
  });

  it("drops undefined prop values rather than refusing them", () => {
    const { islands, frame, operations } = setup();
    islands.mount("a", spec({ props: { title: "Go", subtitle: undefined } }));
    frame();
    expect(operations()[0]).toMatchObject({ props: { title: "Go" } });
  });
});

describe("batching", () => {
  it("folds updates made before the first flush into the mount", () => {
    const { islands, frame, operations } = setup();
    islands.mount("a", spec());
    islands.update("a", { frame: { x: 0, y: 0, width: 50, height: 50 }, props: { title: "B" } });
    frame();
    expect(operations()).toEqual([
      expect.objectContaining({
        op: "mount",
        frame: { x: 0, y: 0, width: 50, height: 50 },
        props: { title: "B" },
      }),
    ]);
  });

  it("sends nothing for an island mounted and unmounted within one frame", () => {
    const { islands, frame, posted, pending } = setup();
    islands.mount("a", spec());
    islands.unmount("a");
    frame();
    expect(posted).toEqual([]);
    expect(pending).toHaveLength(0);
  });

  it("sends only the fields that changed since the last batch", () => {
    const { islands, frame, operations, receive } = setup();
    islands.mount("a", spec());
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    islands.update("a", { frame: { x: 10, y: 20, width: 100, height: 44 }, visible: false });
    islands.update("a", { props: { title: "Continue" }, order: 0 });
    frame();
    expect(operations().slice(1)).toEqual([{ op: "update", id: "a", visible: false }]);
    islands.update("a", { visible: false, anchor: { type: "screen" } });
    frame();
    expect(operations().slice(2)).toEqual([{ op: "update", id: "a", anchor: { type: "screen" } }]);
  });

  it("resends the frame with every cut, shade, turn and fade when only those change", () => {
    const { islands, frame, operations, receive } = setup();
    islands.mount("a", spec());
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    const clip = { x: 0, y: 0, width: 50, height: 44 };
    islands.update("a", { clip, opacity: 0.5 });
    frame();
    expect(operations().slice(1)).toEqual([
      { op: "update", id: "a", frame: spec().frame, clip, opacity: 0.5 },
    ]);
    islands.update("a", { clip: undefined, opacity: undefined });
    frame();
    expect(operations().slice(2)).toEqual([{ op: "update", id: "a", frame: spec().frame }]);
  });

  it("sends no batch when nothing changed", () => {
    const { islands, frame, batches } = setup();
    islands.mount("a", spec());
    frame();
    islands.update("a", { visible: true });
    frame();
    expect(batches()).toHaveLength(1);
  });

  it("schedules one flush per frame however many calls happen", () => {
    const { islands, pending } = setup();
    islands.mount("a", spec());
    islands.mount("b", spec());
    islands.update("a", { visible: false });
    expect(pending).toHaveLength(1);
  });

  it("orders unmounts before mounts so an id can be reused within one frame", () => {
    const { islands, frame, operations } = setup();
    islands.mount("a", spec());
    frame();
    islands.unmount("a");
    islands.mount("a", spec({ props: { title: "Again" } }));
    frame();
    expect(operations().slice(1)).toEqual([
      { op: "unmount", id: "a" },
      expect.objectContaining({ op: "mount", id: "a", props: { title: "Again" } }),
    ]);
  });

  it("splits more operations than one batch may carry across sequences", () => {
    const { islands, frame, batches } = setup();
    const total = NativeComponentLimits.maxIslands;
    for (let index = 0; index < total; index += 1) islands.mount(`a${index}`, spec());
    frame();
    for (let index = 0; index < total; index += 1) {
      islands.update(`a${index}`, { visible: false });
      islands.unmount(`a${index}`);
      islands.mount(`b${index}`, spec());
    }
    frame();
    const sizes = batches().map((batch) => batch.operations.length);
    expect(sizes.every((size) => size <= NativeComponentLimits.maxOperationsPerBatch)).toBe(true);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(total * 3);
    expect(batches().map((batch) => batch.sequence)).toEqual(sizes.map((_, index) => index + 1));
  });

  it("ignores updates and unmounts for ids it does not know", () => {
    const { islands, pending } = setup();
    islands.update("ghost", { visible: false });
    islands.unmount("ghost");
    expect(pending).toHaveLength(0);
  });

  it("flushes on demand", () => {
    const { islands, operations } = setup();
    islands.mount("a", spec());
    islands.flush();
    expect(operations()).toHaveLength(1);
  });
});

describe("acknowledgement", () => {
  it("marks an island ready on its ack and stops its timer", () => {
    const { islands, frame, receive } = setup();
    const listener = setup().listener();
    islands.mount("a", spec(), listener);
    frame();
    expect(receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] })).toBe(true);
    expect(islands.status("a")).toBe("ready");
    expect(listener.onReady).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS * 2);
    expect(listener.onFallback).not.toHaveBeenCalled();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    expect(listener.onReady).toHaveBeenCalledTimes(1);
  });

  it("stalls an island with no ack in time: hidden on the host, kept for a late ack", () => {
    const { islands, frame, operations, receive, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS - 1);
    expect(listener.onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener.onStall).toHaveBeenCalledTimes(1);
    expect(listener.onFallback).not.toHaveBeenCalled();
    expect(islands.status("a")).toBe("stalled");
    frame();
    expect(operations().at(-1)).toEqual({ op: "update", id: "a", visible: false });
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    expect(islands.status("a")).toBe("ready");
    expect(listener.onReady).toHaveBeenCalledTimes(1);
    frame();
    expect(operations().at(-1)).toEqual({ op: "update", id: "a", visible: true });
  });

  it("does not stall twice or after a fallback", () => {
    const { islands, frame, receive, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS * 3);
    expect(listener.onStall).toHaveBeenCalledTimes(1);
    receive({ event_name: "native_component_error", id: "a", reason: "render_failed" });
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS * 3);
    expect(listener.onStall).toHaveBeenCalledTimes(1);
  });

  it("re-mounts stalled islands on retry, unmounting what the host may have drawn", () => {
    const { islands, frame, operations, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    islands.mount("b", spec());
    frame();
    islands.handle({ event_name: "native_component_ack", sequence: 1, ids: ["b"] });
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS);
    frame();
    const before = operations().length;
    islands.retry();
    expect(islands.status("a")).toBe("pending");
    expect(islands.status("b")).toBe("ready");
    expect(listener.onPending).toHaveBeenCalledTimes(1);
    frame();
    expect(operations().slice(before)).toEqual([
      { op: "unmount", id: "a" },
      expect.objectContaining({ op: "mount", id: "a", visible: true }),
    ]);
  });

  it("does nothing on retry with nothing stalled", () => {
    const { islands, pending } = setup();
    islands.retry();
    expect(pending).toHaveLength(0);
  });

  it("honours a custom ack timeout", () => {
    const { islands, frame, listener: make } = setup({ ackTimeoutMs: 50 });
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    vi.advanceTimersByTime(50);
    expect(listener.onStall).toHaveBeenCalledTimes(1);
  });

  it("ignores an ack for an older sequence than the island's mount", () => {
    const { islands, frame, receive, listener: make } = setup();
    islands.mount("a", spec());
    frame();
    islands.unmount("a");
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    expect(islands.status("a")).toBe("pending");
    receive({ event_name: "native_component_ack", sequence: 2, ids: ["a", "unknown"] });
    expect(islands.status("a")).toBe("ready");
  });

  it("ignores an ack for an island not yet sent", () => {
    const { islands, receive } = setup();
    islands.mount("a", spec());
    receive({ event_name: "native_component_ack", sequence: 5, ids: ["a"] });
    expect(islands.status("a")).toBe("pending");
  });

  it("does not time out an island unmounted before its ack", () => {
    const { islands, frame, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    islands.unmount("a");
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS);
    expect(listener.onFallback).not.toHaveBeenCalled();
  });
});

describe("host messages", () => {
  it("falls back on a host error and tells the host to drop the island", () => {
    const { islands, frame, receive, operations, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    receive({
      event_name: "native_component_error",
      id: "a",
      reason: "anchor_not_found",
      message: "no scroller",
    });
    expect(listener.onFallback).toHaveBeenCalledWith("anchor_not_found", "no scroller");
    expect(islands.status("a")).toBeUndefined();
    frame();
    expect(operations().at(-1)).toEqual({ op: "unmount", id: "a" });
    receive({ event_name: "native_component_error", id: "a", reason: "render_failed" });
    expect(listener.onFallback).toHaveBeenCalledTimes(1);
  });

  it("routes events and sizes to the island's listener", () => {
    const { islands, frame, receive, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec({ sizing: "native" }), listener);
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    receive({ event_name: "native_component_event", id: "a", name: "press" });
    receive({ event_name: "native_component_event", id: "a", name: "change", payload: { on: 1 } });
    receive({ event_name: "native_component_size", id: "a", size: { width: 51, height: 31 } });
    receive({ event_name: "native_component_event", id: "b", name: "press" });
    receive({ event_name: "native_component_size", id: "b", size: { width: 1, height: 1 } });
    expect(listener.onEvent).toHaveBeenNthCalledWith(1, "press", undefined);
    expect(listener.onEvent).toHaveBeenNthCalledWith(2, "change", { on: 1 });
    expect(listener.onSize).toHaveBeenCalledWith({ width: 51, height: 31 });
  });

  it("works with listeners that implement nothing", () => {
    const { islands, frame, receive } = setup();
    islands.mount("a", spec());
    islands.mount("b", spec());
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    receive({ event_name: "native_component_event", id: "a", name: "press" });
    receive({ event_name: "native_component_size", id: "a", size: { width: 1, height: 1 } });
    receive({ event_name: "native_component_error", id: "a", reason: "render_failed" });
    vi.advanceTimersByTime(NATIVE_ACK_TIMEOUT_MS);
    expect(islands.status("b")).toBe("stalled");
    islands.retry();
    expect(islands.status("b")).toBe("pending");
  });

  it("re-mounts with fresh geometry from refresh and tells the island it is pending again", () => {
    const { islands, frame, receive, operations, listener: make } = setup();
    const listener = make();
    const refresh = vi.fn(() => ({ frame: { x: 1, y: 2, width: 3, height: 4 } }));
    islands.mount("a", spec(), { ...listener, refresh });
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    receive({ event_name: "native_component_reset" });
    expect(listener.onPending).toHaveBeenCalledTimes(1);
    frame();
    expect(operations().at(-1)).toMatchObject({
      op: "mount",
      frame: { x: 1, y: 2, width: 3, height: 4 },
    });
  });

  it("falls back when refresh returns props that cannot cross", () => {
    const { islands, frame, receive, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), { ...listener, refresh: () => ({ props: { f: () => 1 } }) });
    frame();
    receive({ event_name: "native_component_reset" });
    expect(listener.onFallback).toHaveBeenCalledWith("invalid_spec", undefined);
    expect(listener.onPending).not.toHaveBeenCalled();
  });

  it("re-mounts every live island when the host resets", () => {
    const { islands, frame, receive, operations, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    islands.mount("b", spec());
    frame();
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a", "b"] });
    islands.unmount("b");
    expect(receive({ event_name: "native_component_reset" })).toBe(true);
    expect(islands.status("a")).toBe("pending");
    frame();
    expect(operations().slice(2)).toEqual([expect.objectContaining({ op: "mount", id: "a" })]);
    receive({ event_name: "native_component_ack", sequence: 2, ids: ["a"] });
    expect(listener.onReady).toHaveBeenCalledTimes(2);
  });

  it("does nothing on reset with no islands", () => {
    const { islands, pending } = setup();
    islands.resync();
    expect(pending).toHaveLength(0);
  });

  it("leaves every other message alone, and anything that is not a message", () => {
    const { islands } = setup();
    expect(islands.handle({ event_name: "restore_complete" })).toBe(false);
    expect(islands.handle({ event_name: 4 })).toBe(false);
    expect(islands.handle({ id: "a" })).toBe(false);
    expect(islands.handle(null)).toBe(false);
    expect(islands.handle("native_component_reset")).toBe(false);
  });
});

describe("stale and malformed host messages", () => {
  it("ignores errors, sizes and events that belong to an earlier mount of the same id", () => {
    const { islands, frame, receive, listener: make } = setup();
    islands.mount("a", spec());
    frame();
    islands.unmount("a");
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    receive({ event_name: "native_component_ack", sequence: 2, ids: ["a"] });
    receive({
      event_name: "native_component_size",
      id: "a",
      size: { width: 9, height: 9 },
      sequence: 1,
    });
    receive({ event_name: "native_component_event", id: "a", name: "press", sequence: 1 });
    receive({
      event_name: "native_component_error",
      id: "a",
      reason: "render_failed",
      sequence: 1,
    });
    expect(listener.onSize).not.toHaveBeenCalled();
    expect(listener.onEvent).not.toHaveBeenCalled();
    expect(listener.onFallback).not.toHaveBeenCalled();
    receive({ event_name: "native_component_event", id: "a", name: "press", sequence: 2 });
    expect(listener.onEvent).toHaveBeenCalledTimes(1);
  });

  it("drops events for an island that is not acknowledged or not visible", () => {
    const { islands, frame, receive, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    receive({ event_name: "native_component_event", id: "a", name: "press" });
    receive({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    islands.update("a", { visible: false });
    frame();
    receive({ event_name: "native_component_event", id: "a", name: "press" });
    expect(listener.onEvent).not.toHaveBeenCalled();
  });

  it("ignores malformed messages with a warning", () => {
    const report = vi.fn();
    const islands = createNativeIslands({ capability, post: vi.fn(), report });
    const onFallback = vi.fn();
    islands.mount("a", spec(), { onFallback });
    islands.flush();
    for (const message of [
      { event_name: "native_component_ack", sequence: 1 },
      { event_name: "native_component_error", id: "a", reason: "bogus" },
      { event_name: "native_component_event", id: "a" },
      { event_name: "native_component_size", id: "a", size: { width: -1, height: 1 } },
    ]) {
      expect(islands.handle(message as unknown as TToPageMessage)).toBe(true);
    }
    expect(report).toHaveBeenCalledTimes(4);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("isolates a throwing handler so the rest of the batch still runs", () => {
    const report = vi.fn();
    const islands = createNativeIslands({
      capability,
      post: vi.fn(),
      report,
      schedule: (flush) => flush(),
    });
    const onEvent = vi.fn();
    islands.mount("a", spec(), {
      onEvent: () => {
        throw new Error("bad payload");
      },
    });
    islands.mount("b", spec(), { onEvent });
    islands.handle({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    islands.handle({ event_name: "native_component_ack", sequence: 2, ids: ["b"] });
    islands.handle({ event_name: "native_component_event", id: "a", name: "change" });
    islands.handle({ event_name: "native_component_event", id: "b", name: "change" });
    expect(report).toHaveBeenCalledWith(
      'A handler for native component "a" threw.',
      expect.any(Error),
    );
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("reports through the console by default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const islands = createNativeIslands({
      capability,
      post: vi.fn(),
      schedule: (flush) => flush(),
    });
    islands.handle({ event_name: "native_component_ack" } as unknown as TToPageMessage);
    expect(warn).toHaveBeenCalledWith(
      "Ignored a malformed native_component_ack message from the host.",
    );
    islands.mount("a", spec(), {
      onReady: () => {
        throw new Error("x");
      },
    });
    islands.handle({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    expect(error).toHaveBeenCalledWith(
      'A handler for native component "a" threw.',
      expect.any(Error),
    );
    warn.mockRestore();
    error.mockRestore();
  });
});

describe("anchors and ids", () => {
  it("refuses an anchor the host does not offer, at mount and on update", () => {
    const limited = readNativeCapability({
      protocol: 1,
      components: { glassButton: 1 },
      anchors: ["page"],
    });
    const onFallback = vi.fn();
    const islands = createNativeIslands({
      capability: limited,
      post: vi.fn(),
      schedule: (flush) => flush(),
    });
    expect(islands.mount("a", spec({ anchor: { type: "screen" } }))).toEqual({
      ok: false,
      reason: "unsupported_anchor",
    });
    islands.mount("b", spec(), { onFallback });
    islands.update("b", { anchor: { type: "screen" } });
    expect(onFallback).toHaveBeenCalledWith(
      "anchor_not_found",
      "the host does not offer the screen anchor",
    );
  });

  it("refuses ids the protocol cannot carry when mounting", () => {
    const { islands } = setup();
    expect(islands.mount("", spec())).toEqual({ ok: false, reason: "invalid_spec" });
    expect(islands.mount("x".repeat(NativeComponentLimits.maxIdLength + 1), spec())).toEqual({
      ok: false,
      reason: "invalid_spec",
    });
  });
});

describe("invalid specs", () => {
  it("falls back when a mount carries a frame the host cannot take", () => {
    const { islands, frame, posted, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec({ frame: { x: 0, y: 0, width: -1, height: 10 } }), listener);
    frame();
    expect(listener.onFallback).toHaveBeenCalledWith("invalid_spec", undefined);
    expect(posted).toEqual([]);
  });

  it("falls back and unmounts when an update carries a frame the host cannot take", () => {
    const { islands, frame, operations, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    islands.update("a", { frame: { x: Number.NaN, y: 0, width: 1, height: 1 } });
    frame();
    expect(listener.onFallback).toHaveBeenCalledWith("invalid_spec", undefined);
    frame();
    expect(operations().at(-1)).toEqual({ op: "unmount", id: "a" });
  });

  it("falls back when an update carries props that cannot cross the bridge", () => {
    const { islands, frame, listener: make } = setup();
    const listener = make();
    islands.mount("a", spec(), listener);
    frame();
    islands.update("a", { props: { onPress: () => undefined } });
    expect(listener.onFallback).toHaveBeenCalledWith("invalid_spec", undefined);
  });
});

describe("toNativeProps", () => {
  it("keeps JSON values and refuses everything else", () => {
    expect(toNativeProps({ a: 1, b: "x", c: [true, null, { d: 2 }] })).toEqual({
      a: 1,
      b: "x",
      c: [true, null, { d: 2 }],
    });
    expect(toNativeProps(Object.create(null) as Record<string, unknown>)).toEqual({});
    expect(toNativeProps([] as unknown as Record<string, unknown>)).toBeUndefined();
    expect(toNativeProps(null as unknown as Record<string, unknown>)).toBeUndefined();
    expect(toNativeProps("title" as unknown as Record<string, unknown>)).toBeUndefined();
    const shared = { x: 1 };
    expect(toNativeProps({ first: shared, second: shared })).toEqual({
      first: { x: 1 },
      second: { x: 1 },
    });
    expect(toNativeProps({ list: [undefined] })).toBeUndefined();
  });
});

describe("default scheduler", () => {
  type Frames = FrameRequestCallback[];
  const stubFrames = (): Frames => {
    const frames: Frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    return frames;
  };
  const runFrames = (frames: Frames) => {
    for (const callback of frames.splice(0)) callback(0);
  };
  const scroller = (id: string): NativeIslandSpec["anchor"] => ({
    type: "scroller",
    scroller: {
      id,
      frame: { x: 0, y: 0, width: 400, height: 800 },
      content_size: { width: 400, height: 2000 },
      scroll_offset: { x: 0, y: 0 },
    },
  });
  // The first island in a container goes on the next frame; once the host has
  // shown one there, the page knows the container exists.
  const reachedPage = (post: (message: TToHostMessage) => void, frames: Frames) => {
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec());
    runFrames(frames);
    runFrames(frames);
    islands.handle({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    return islands;
  };

  afterEach(() => vi.unstubAllGlobals());

  it("posts the first island in a container two frames later, after WebKit drew it", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec());
    await Promise.resolve();
    runFrames(frames);
    expect(post).not.toHaveBeenCalled();
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("keeps the first island in a container back when an update flushes on the next frame", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.mount("b", spec({ anchor: scroller("s1") }));
    islands.update("a", { props: { title: "Changed" } });
    await Promise.resolve();
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toMatchObject({ operations: [{ op: "update", id: "a" }] });
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[2]?.[0]).toMatchObject({ operations: [{ op: "mount", id: "b" }] });
  });

  it("posts a held island when the page asks for a flush", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.mount("b", spec({ anchor: scroller("s1") }));
    await Promise.resolve();
    islands.flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toMatchObject({ operations: [{ op: "mount", id: "b" }] });
  });

  it("gives the first island in a container one more try when the host cannot find it", () => {
    const frames = stubFrames();
    const post = vi.fn();
    const onFallback = vi.fn();
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec({ anchor: scroller("s1") }), { onFallback });
    runFrames(frames);
    runFrames(frames);
    const error = (sequence: number) => ({
      event_name: "native_component_error",
      id: "a",
      reason: "anchor_not_found",
      sequence,
    });
    islands.handle(error(1));
    expect(onFallback).not.toHaveBeenCalled();
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(2);
    islands.handle(error(2));
    expect(onFallback).toHaveBeenCalledWith("anchor_not_found", undefined);
  });

  it("posts a new mount into a container the host already drew in before the next frame", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.mount("b", spec());
    islands.mount("c", spec());
    expect(post).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toMatchObject({
      operations: [
        { op: "mount", id: "b" },
        { op: "mount", id: "c" },
      ],
    });
    expect(frames).toHaveLength(0);
  });

  it("tells scrollers apart: a new scroller waits for the next frame", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec({ anchor: scroller("s1") }));
    runFrames(frames);
    runFrames(frames);
    islands.handle({ event_name: "native_component_ack", sequence: 1, ids: ["a"] });
    islands.mount("b", spec({ anchor: scroller("s2") }));
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    runFrames(frames);
    runFrames(frames);
    expect(post.mock.calls[1]?.[0]).toMatchObject({ operations: [{ op: "mount", id: "b" }] });
    islands.mount("c", spec({ anchor: scroller("s1") }));
    await Promise.resolve();
    expect(post.mock.calls[2]?.[0]).toMatchObject({ operations: [{ op: "mount", id: "c" }] });
  });

  it("mounts again on the next frame when the host cannot find the container of an early mount", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const onFallback = vi.fn();
    const onPending = vi.fn();
    const islands = reachedPage(post, frames);
    islands.mount("b", spec(), { onFallback, onPending });
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
    islands.handle({
      event_name: "native_component_error",
      id: "b",
      reason: "anchor_not_found",
      sequence: 2,
    });
    expect(onFallback).not.toHaveBeenCalled();
    expect(onPending).toHaveBeenCalledTimes(1);
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[2]?.[0]).toMatchObject({ operations: [{ op: "mount", id: "b" }] });
    islands.handle({
      event_name: "native_component_error",
      id: "b",
      reason: "anchor_not_found",
      sequence: 3,
    });
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("forgets the containers it reached when the host resets", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.resync();
    runFrames(frames);
    runFrames(frames);
    const posts = post.mock.calls.length;
    islands.mount("b", spec());
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(posts);
  });

  it("sends an unmount queued in the same task with the new mount", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.unmount("a");
    islands.mount("b", spec());
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toMatchObject({
      operations: [
        { op: "unmount", id: "a" },
        { op: "mount", id: "b" },
      ],
    });
    runFrames(frames);
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("flushes updates on the next animation frame", async () => {
    const frames = stubFrames();
    const post = vi.fn();
    const islands = reachedPage(post, frames);
    islands.update("a", { props: { title: "Later" } });
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    runFrames(frames);
    expect(post).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("still flushes when animation frames never fire, as in a page preloaded off screen", () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const post = vi.fn();
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec());
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("flushes by timer where animation frames do not exist", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const post = vi.fn();
    const islands = createNativeIslands({ capability, post });
    islands.mount("a", spec());
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NATIVE_FLUSH_FALLBACK_MS);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("custom scheduler", () => {
  it("decides when a new mount is posted", async () => {
    const { islands, posted, frame } = setup();
    islands.mount("a", spec());
    await Promise.resolve();
    expect(posted).toHaveLength(0);
    frame();
    expect(posted).toHaveLength(1);
  });
});

describe("announceReady", () => {
  it("sends pending operations, then the last sequence, once", () => {
    const { islands, posted } = setup();
    islands.mount("cta", spec(), undefined);
    expect(islands.announceReady()).toBe(true);
    expect(posted.map((message) => message.event_name)).toEqual([
      "native_component_batch",
      "native_islands_ready",
    ]);
    expect(posted[1]).toEqual({ event_name: "native_islands_ready", sequence: 1 });
    expect(islands.announceReady()).toBe(false);
    expect(posted).toHaveLength(2);
  });

  it("announces sequence 0 for a page with no islands", () => {
    const { islands, posted } = setup();
    expect(islands.announceReady()).toBe(true);
    expect(posted).toEqual([{ event_name: "native_islands_ready", sequence: 0 }]);
  });

  it("sends nothing to a host that offers no islands", () => {
    const posted: TToHostMessage[] = [];
    const islands = createNativeIslands({
      capability: { status: "absent" },
      post: (message) => posted.push(message),
    });
    expect(islands.announceReady()).toBe(false);
    expect(posted).toEqual([]);
  });
});
