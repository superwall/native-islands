import { afterEach, describe, expect, it, vi } from "vitest";
import { connectNativeIslands } from "../../src/bridge/connect";
import { NATIVE_CAPABILITY_GLOBAL } from "../../src/protocol/schemas";
import { NATIVE_RECEIVER_GLOBAL, type NativeIslandsTransport } from "../../src/bridge/transport";
import type { NativeIslandSpec } from "../../src/islands/controller";
import type { TToHostMessage } from "../../src/protocol/messages";

const capability = {
  protocol: 1,
  components: { glassButton: 1 },
  anchors: ["page", "scroller", "screen"],
  features: ["state", "requests", "commands"],
};

const spec: NativeIslandSpec = {
  component: "glassButton",
  version: 1,
  props: { title: "Go" },
  frame: { x: 0, y: 0, width: 100, height: 44 },
  anchor: { type: "page" },
  visible: true,
  order: 0,
  sizing: "web",
};

const fakeTransport = (reachable = true) => {
  const posted: TToHostMessage[] = [];
  let deliver: (message: unknown) => void = () => undefined;
  const stop = vi.fn();
  const transport: NativeIslandsTransport = {
    post: (message) => {
      posted.push(message);
      return reachable;
    },
    listen: (listener) => {
      deliver = listener;
      return stop;
    },
  };
  return { transport, posted, deliver: (message: unknown) => deliver(message), stop };
};

const globals = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete globals[NATIVE_CAPABILITY_GLOBAL];
  delete globals[NATIVE_RECEIVER_GLOBAL];
  delete globals.webkit;
  vi.restoreAllMocks();
});

describe("connectNativeIslands", () => {
  it("sends batches through the transport and hands the host's answers to the controller", () => {
    const host = fakeTransport();
    const onReady = vi.fn();
    const { islands, disconnect } = connectNativeIslands({
      transport: host.transport,
      capability,
      schedule: (flush) => flush(),
    });
    expect(islands.mount("cta", spec, { onReady })).toEqual({ ok: true });
    expect(host.posted).toEqual([
      expect.objectContaining({ event_name: "native_component_batch", sequence: 1 }),
    ]);
    host.deliver({ event_name: "native_component_ack", sequence: 1, ids: ["cta"] });
    expect(onReady).toHaveBeenCalledOnce();
    disconnect();
    expect(host.stop).toHaveBeenCalledOnce();
  });

  it("listens again after a disconnect, once", () => {
    const host = fakeTransport();
    const listen = vi.spyOn(host.transport, "listen");
    const { islands, disconnect, reconnect } = connectNativeIslands({
      transport: host.transport,
      capability,
      schedule: (flush) => flush(),
    });
    reconnect();
    expect(listen).toHaveBeenCalledTimes(1);
    disconnect();
    disconnect();
    expect(host.stop).toHaveBeenCalledTimes(1);
    reconnect();
    expect(listen).toHaveBeenCalledTimes(2);
    const onReady = vi.fn();
    islands.mount("cta", spec, { onReady });
    host.deliver({ event_name: "native_component_ack", sequence: 1, ids: ["cta"] });
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("reads the capability from window.__NATIVE_ISLANDS__ by default", () => {
    globals[NATIVE_CAPABILITY_GLOBAL] = capability;
    const { islands } = connectNativeIslands({ transport: fakeTransport().transport });
    expect(islands.supports("glassButton", 1)).toBe("supported");
  });

  it("treats an explicitly missing capability as no host, and warns about a malformed one", () => {
    globals[NATIVE_CAPABILITY_GLOBAL] = capability;
    const report = vi.fn();
    const absent = connectNativeIslands({
      transport: fakeTransport().transport,
      capability: undefined,
      report,
    });
    expect(absent.islands.capability).toEqual({ status: "absent" });
    expect(report).not.toHaveBeenCalled();
    connectNativeIslands({
      transport: fakeTransport().transport,
      capability: { protocol: "1" },
      report,
    });
    expect(report).toHaveBeenCalledWith(
      expect.stringMatching(/^The host's native island capability is malformed/),
    );
  });

  it("reports a batch no host received", () => {
    const report = vi.fn();
    const { islands } = connectNativeIslands({
      transport: fakeTransport(false).transport,
      capability,
      schedule: (flush) => flush(),
      report,
    });
    islands.mount("cta", spec);
    expect(report).toHaveBeenCalledWith("No host received native_component_batch.");
  });

  it("uses the WebKit transport and warns on the console by default", () => {
    const postMessage = vi.fn();
    globals.webkit = { messageHandlers: { nativeIslands: { postMessage } } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { islands } = connectNativeIslands({ capability, schedule: (flush) => flush() });
    islands.mount("cta", spec);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "native_component_batch" }),
    );
    (globals[NATIVE_RECEIVER_GLOBAL] as { accept: (value: unknown) => void }).accept("nope");
    expect(warn).toHaveBeenCalledWith(
      "Ignored a delivery from the host that is not an array of messages.",
    );
    (globals[NATIVE_RECEIVER_GLOBAL] as { accept64: (value: string) => void }).accept64("%");
    expect(error).toHaveBeenCalledWith(
      "Ignored a delivery from the host that is not base64 JSON.",
      expect.anything(),
    );
    connectNativeIslands({ capability: { protocol: "1" } });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^The host's native island capability is malformed/),
    );
  });
});
