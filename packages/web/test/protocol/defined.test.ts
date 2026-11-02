import { describe, expect, it } from "vitest";
import { withoutUndefined } from "../../src/protocol/defined";

describe("withoutUndefined", () => {
  it("drops undefined fields and keeps every other value, without touching the input", () => {
    const input = { a: 1, b: undefined, c: null, d: 0, e: false, f: "" };
    const result = withoutUndefined(input);
    expect(result).toStrictEqual({ a: 1, c: null, d: 0, e: false, f: "" });
    expect("b" in result).toBe(false);
    expect("b" in input).toBe(true);
  });
});
