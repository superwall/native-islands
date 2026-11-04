import { describe, expect, it } from "vitest";
import { sameJson, withoutUndefined } from "../../src/protocol/defined";

describe("withoutUndefined", () => {
  it("drops undefined fields and keeps every other value, without touching the input", () => {
    const input = { a: 1, b: undefined, c: null, d: 0, e: false, f: "" };
    const result = withoutUndefined(input);
    expect(result).toStrictEqual({ a: 1, c: null, d: 0, e: false, f: "" });
    expect("b" in result).toBe(false);
    expect("b" in input).toBe(true);
  });
});

describe("sameJson", () => {
  it("compares JSON values by structure", () => {
    const frame = { x: 1, y: [2, { z: 3 }] };
    expect(sameJson(frame, frame)).toBe(true);
    expect(sameJson(frame, { x: 1, y: [2, { z: 3 }] })).toBe(true);
    expect(sameJson(frame, { x: 1, y: [2, { z: 4 }] })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameJson({ a: 1, b: undefined }, { a: 1, c: undefined })).toBe(false);
    expect(sameJson([1], { 0: 1 })).toBe(false);
    expect(sameJson(1, 2)).toBe(false);
    expect(sameJson(null, {})).toBe(false);
    expect(sameJson({}, null)).toBe(false);
    expect(sameJson("a", "a")).toBe(true);
  });
});
