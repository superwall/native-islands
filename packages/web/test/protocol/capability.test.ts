import { afterEach, describe, expect, it } from "vitest";
import {
  describeNativeCapability,
  nativeCapabilityFromGlobal,
  nativeSupport,
  readNativeCapability,
  supportsAnchor,
  supportsFeature,
} from "../../src/protocol/capability";

const available = readNativeCapability({
  protocol: 1,
  components: { glassButton: 2, toggle: 1 },
});

describe("readNativeCapability", () => {
  it("reports absent when the host injected nothing", () => {
    expect(readNativeCapability(undefined)).toEqual({ status: "absent" });
    expect(readNativeCapability(null)).toEqual({ status: "absent" });
  });

  it("reports invalid, with the reason, instead of treating a malformed value as absent", () => {
    const result = readNativeCapability({ protocol: "1", components: [] });
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.reason.length > 0).toBe(true);
  });

  it("reads a well-formed capability", () => {
    expect(available).toEqual({
      status: "available",
      capability: { protocol: 1, components: { glassButton: 2, toggle: 1 }, features: [] },
      ignored: [],
    });
  });
});

describe("nativeSupport", () => {
  it("supports a registered component at or below its registered version", () => {
    expect(nativeSupport(available, "glassButton", 1)).toBe("supported");
    expect(nativeSupport(available, "glassButton", 2)).toBe("supported");
  });

  it("refuses a component the app registered at an older version", () => {
    expect(nativeSupport(available, "glassButton", 3)).toBe("unsupported_version");
  });

  it("refuses unknown components, including inherited object keys", () => {
    expect(nativeSupport(available, "slider", 1)).toBe("unknown_component");
    expect(nativeSupport(available, "constructor", 1)).toBe("unknown_component");
    expect(nativeSupport(available, "toString", 1)).toBe("unknown_component");
  });

  it("is unavailable without a valid capability", () => {
    expect(nativeSupport({ status: "absent" }, "glassButton", 1)).toBe("unavailable");
    expect(nativeSupport({ status: "invalid", reason: "x" }, "glassButton", 1)).toBe("unavailable");
  });
});

describe("nativeCapabilityFromGlobal", () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__NATIVE_ISLANDS__;
  });

  it("reads window.__NATIVE_ISLANDS__", () => {
    expect(nativeCapabilityFromGlobal()).toBeUndefined();
    const capability = { protocol: 1, components: {} };
    (window as unknown as Record<string, unknown>).__NATIVE_ISLANDS__ = capability;
    expect(nativeCapabilityFromGlobal()).toBe(capability);
  });
});

describe("forward compatibility", () => {
  it("keeps the parts it understands and lists what it ignored", () => {
    const result = readNativeCapability({
      protocol: 2,
      components: { glassButton: 1, [`x${"y".repeat(70)}`]: 1, broken: "1", zero: 0 },
      anchors: ["page", "sheet", "screen"],
    });
    expect(result).toEqual({
      status: "available",
      capability: {
        protocol: 2,
        components: { glassButton: 1 },
        anchors: ["page", "screen"],
        features: [],
      },
      ignored: [
        `component "x${"y".repeat(70)}"`,
        'component "broken"',
        'component "zero"',
        'anchor "sheet"',
      ],
    });
    expect(describeNativeCapability(result)).toBe(
      `Ignored parts of the host's native island capability this page does not understand: component "x${"y".repeat(70)}", component "broken", component "zero", anchor "sheet".`,
    );
  });

  it("names the problem with a malformed capability", () => {
    const result = readNativeCapability({ protocol: "1", components: [] });
    expect(describeNativeCapability(result)).toMatch(
      /^The host's native island capability is malformed, so every island shows its web version: protocol: /,
    );
    expect(readNativeCapability([])).toMatchObject({ status: "invalid" });
    expect(describeNativeCapability(readNativeCapability([]))).toContain("capability: ");
  });

  it("says nothing for a clean or absent capability", () => {
    expect(describeNativeCapability(available)).toBeUndefined();
    expect(describeNativeCapability(readNativeCapability(undefined))).toBeUndefined();
  });

  it("checks anchors only when the host lists them", () => {
    expect(supportsAnchor(available, "scroller")).toBe(true);
    const limited = readNativeCapability({ protocol: 1, components: {}, anchors: ["page"] });
    expect(supportsAnchor(limited, "page")).toBe(true);
    expect(supportsAnchor(limited, "scroller")).toBe(false);
    expect(supportsAnchor(readNativeCapability(undefined), "page")).toBe(false);
  });

  it("keeps the features it knows and ignores the rest", () => {
    const result = readNativeCapability({
      protocol: 1,
      components: {},
      features: ["state", "nativeHeight", "teleport"],
    });
    expect(supportsFeature(result, "state")).toBe(true);
    expect(supportsFeature(result, "nativeHeight")).toBe(true);
    expect(supportsFeature(result, "commands")).toBe(false);
    expect(supportsFeature(readNativeCapability(undefined), "state")).toBe(false);
    expect(result.status === "available" && result.ignored).toEqual(['feature "teleport"']);
  });
});
