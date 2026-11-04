import { describe, expect, it } from "vitest";
import * as root from "../../src";
import * as protocol from "../../src/protocol";

describe("package entries", () => {
  it("offers only the page runtime from the root entry", () => {
    expect(Object.keys(root).toSorted()).toEqual([
      "ISLAND_PHASE_ATTRIBUTE",
      "NativeCommandError",
      "connectNativeIslands",
      "describeNativeCapability",
      "nativeCapabilityFromGlobal",
      "nativeSupport",
      "readNativeCapability",
      "supportsAnchor",
      "supportsFeature",
    ]);
  });

  it("offers what another host or transport needs from the protocol entry", () => {
    expect(protocol).toMatchObject({
      NATIVE_PROTOCOL_VERSION: expect.any(Number),
      NATIVE_MESSAGE_HANDLER: expect.any(String),
      NATIVE_CAPABILITY_GLOBAL: expect.any(String),
      NATIVE_RECEIVER_GLOBAL: "__nativeIslands",
      ISLAND_ID_ATTRIBUTE: "data-island-id",
      ISLAND_MODE_ATTRIBUTE: "data-island-mode",
      ISLAND_SHOWN_ATTRIBUTE: "data-island-shown",
      ISLAND_HANDOFF_ATTRIBUTE: "data-island-handoff",
      createNativeIslands: expect.any(Function),
      createWebKitTransport: expect.any(Function),
    });
    expect(
      protocol.ToHostMessageSchema.safeParse({ event_name: "native_islands_ready", sequence: 1 })
        .success,
    ).toBe(true);
    expect(protocol.ToPageMessageSchema).toBeDefined();
  });

  it("keeps layout helpers and page tuning out of both entries", () => {
    for (const name of ["anchorOf", "createLayoutWatcher", "handoffOf", "NATIVE_ACK_TIMEOUT_MS"]) {
      expect(root).not.toHaveProperty(name);
      expect(protocol).not.toHaveProperty(name);
    }
  });
});
