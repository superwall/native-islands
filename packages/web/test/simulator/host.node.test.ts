// @vitest-environment node
import { describe, expect, it } from "vitest";
import { installNativeSimulator } from "../../src/simulator";

describe("installNativeSimulator outside a browser", () => {
  it("says it needs a window", () => {
    expect(() => installNativeSimulator()).toThrow("The native simulator needs a browser window.");
  });
});
