import { describe, expect, it } from "bun:test";
import { arcPath, niceMaximum, slotAt, stepped } from "../src/ui/geometry";

const RING = { cx: 40, cy: 40, radius: 32 };

describe("arcPath", () => {
  it("draws nothing for an empty gauge", () => {
    expect(arcPath(0, { ...RING, start: -135, sweep: 270 })).toBe("");
    expect(arcPath(-1, { ...RING, start: 0, sweep: 360 })).toBe("");
  });

  it("starts at the top for 0 degrees and sweeps clockwise", () => {
    expect(arcPath(0.25, { ...RING, start: 0, sweep: 360 })).toBe(
      "M 40.00 8.00 A 32 32 0 0 1 72.00 40.00",
    );
  });

  it("uses the large arc past half a turn", () => {
    expect(arcPath(1, { ...RING, start: -135, sweep: 270 })).toContain(" 0 1 1 ");
  });

  it("closes a full ring with two arcs and clamps above one", () => {
    const full = arcPath(2, { ...RING, start: 0, sweep: 360 });
    expect(full.match(/A /g)).toHaveLength(2);
    expect(full.startsWith("M 40.00 8.00")).toBe(true);
  });
});

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

describe("stepped", () => {
  it("steps within the range", () => {
    expect(stepped(2, 1, 0, 10)).toBe(3);
    expect(stepped(0, -1, 0, 10)).toBe(0);
    expect(stepped(11.5, 0.5, 4, 12)).toBe(12);
  });

  it("does not drift on fractional steps", () => {
    let value = 0;
    for (let index = 0; index < 10; index += 1) value = stepped(value, 0.1, 0, 5);
    expect(value).toBe(1);
  });
});
