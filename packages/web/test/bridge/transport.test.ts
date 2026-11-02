import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWebKitTransport,
  NATIVE_RECEIVER_GLOBAL,
  type NativeIslandsReceiver,
  type TToHostMessage,
} from "../../src";
import { decodeBase64Json } from "../../src/bridge/transport";

type HostWindow = Window & {
  webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
  [NATIVE_RECEIVER_GLOBAL]?: NativeIslandsReceiver;
};

const fresh = () => ({}) as unknown as Window;

const base64Of = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes));
};

const reset: TToHostMessage = {
  event_name: "native_component_batch",
  protocol: 1,
  sequence: 1,
  operations: [{ op: "unmount", id: "a" }],
};

afterEach(() => {
  delete (window as HostWindow).webkit;
  delete (window as HostWindow)[NATIVE_RECEIVER_GLOBAL];
  vi.restoreAllMocks();
});

describe("decodeBase64Json", () => {
  it("decodes UTF-8 JSON, not just ASCII", () => {
    expect(decodeBase64Json(base64Of([{ title: "Weiter → Café ✓" }]))).toEqual([
      { title: "Weiter → Café ✓" },
    ]);
  });
});

describe("createWebKitTransport", () => {
  it("posts to the nativeIslands handler as a plain object", () => {
    const target = window as HostWindow;
    const postMessage = vi.fn();
    target.webkit = { messageHandlers: { nativeIslands: { postMessage } } };
    expect(createWebKitTransport().post(reset)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(reset);
  });

  it("reports that nothing was sent when there is no host", () => {
    expect(createWebKitTransport().post(reset)).toBe(false);
    (window as HostWindow).webkit = { messageHandlers: {} };
    expect(createWebKitTransport().post(reset)).toBe(false);
  });

  it("installs one receiver per window that delivers to every listener, in order", () => {
    const target = fresh() as HostWindow;
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = createWebKitTransport({ window: target }).listen(first);
    createWebKitTransport({ window: target }).listen(second);
    const receiver = target[NATIVE_RECEIVER_GLOBAL] as NativeIslandsReceiver;
    receiver.accept64(base64Of([{ event_name: "a" }, { event_name: "b" }]));
    expect(first.mock.calls).toEqual([[{ event_name: "a" }], [{ event_name: "b" }]]);
    expect(second).toHaveBeenCalledTimes(2);
    stopFirst();
    receiver.accept([{ event_name: "c" }]);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith({ event_name: "c" });
  });

  it("reports deliveries it cannot read and listeners that throw, and keeps going", () => {
    const target = fresh() as HostWindow;
    const report = vi.fn();
    const error = new Error("boom");
    const after = vi.fn();
    const transport = createWebKitTransport({ window: target, report });
    transport.listen(() => {
      throw error;
    });
    transport.listen(after);
    const receiver = target[NATIVE_RECEIVER_GLOBAL] as NativeIslandsReceiver;
    receiver.accept64("not base64 json");
    expect(report).toHaveBeenCalledWith(
      "Ignored a delivery from the host that is not base64 JSON.",
      expect.anything(),
    );
    receiver.accept64(base64Of({ event_name: "a" }));
    expect(report).toHaveBeenCalledWith(
      "Ignored a delivery from the host that is not an array of messages.",
    );
    receiver.accept([{ event_name: "a" }]);
    expect(report).toHaveBeenCalledWith("A native islands listener threw.", error);
    expect(after).toHaveBeenCalledWith({ event_name: "a" });
  });

  it("reports to the console by default", () => {
    const target = fresh() as HostWindow;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createWebKitTransport({ window: target }).listen(() => undefined);
    target[NATIVE_RECEIVER_GLOBAL]?.accept("nope");
    expect(error).toHaveBeenCalledWith(
      "Ignored a delivery from the host that is not an array of messages.",
      undefined,
    );
  });
});
