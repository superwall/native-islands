// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createWebKitTransport, type TToHostMessage } from "../../src";
import { hostWindow } from "../../src/bridge/transport";

const reset: TToHostMessage = {
  event_name: "native_component_batch",
  protocol: 1,
  sequence: 1,
  operations: [{ op: "unmount", id: "a" }],
};

describe("the WebKit transport without a window", () => {
  it("finds no host window", () => {
    expect(hostWindow()).toBeUndefined();
  });

  it("posts nothing and listens to nothing", () => {
    const transport = createWebKitTransport();
    expect(transport.post(reset)).toBe(false);
    const unsubscribe = transport.listen(() => undefined);
    expect(unsubscribe()).toBeUndefined();
  });

  it("still uses a window it is given", () => {
    const posted: unknown[] = [];
    const target = {
      webkit: {
        messageHandlers: { nativeIslands: { postMessage: (m: unknown) => posted.push(m) } },
      },
    } as unknown as Window;
    expect(hostWindow(target)).toBe(target);
    expect(createWebKitTransport({ window: target }).post(reset)).toBe(true);
    expect(posted).toEqual([reset]);
  });
});
