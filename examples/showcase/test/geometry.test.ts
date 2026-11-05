import { describe, expect, it } from "bun:test";
import { niceMaximum, slotAt } from "../src/ui/geometry";

describe("niceMaximum", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect([
      niceMaximum([11]),
      niceMaximum([3, 4]),
      niceMaximum([0.7]),
      niceMaximum([200]),
      niceMaximum([501]),
    ]).toEqual([20, 5, 1, 200, 1000]);
  });

  it("gives an empty or all-zero chart a scale", () => {
    expect(niceMaximum([])).toBe(1);
    expect(niceMaximum([0, -3])).toBe(1);
  });
});

describe("slotAt", () => {
  it("finds the slot under a point", () => {
    expect(slotAt(0, 70, 7)).toBe(0);
    expect(slotAt(35, 70, 7)).toBe(3);
    expect(slotAt(70, 70, 7)).toBe(6);
  });

  it("is nothing outside the chart", () => {
    expect(slotAt(-1, 70, 7)).toBeUndefined();
    expect(slotAt(71, 70, 7)).toBeUndefined();
    expect(slotAt(10, 70, 0)).toBeUndefined();
    expect(slotAt(10, 0, 7)).toBeUndefined();
  });
});
