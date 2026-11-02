// @vitest-environment node
import { describe, expect, it } from "vitest";
import { nativeCapabilityFromGlobal } from "../src";

describe("nativeCapabilityFromGlobal outside a browser", () => {
  it("returns undefined when there is no window", () => {
    expect(nativeCapabilityFromGlobal()).toBeUndefined();
  });
});
