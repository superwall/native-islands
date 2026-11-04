import { describe, expect, it } from "vitest";
import {
  daysIn,
  describeDate,
  describeMonth,
  describeTime,
  formatLocal,
  monthGrid,
  parseLocal,
  shiftMonth,
} from "../../src/components/dates";
import { arcPath, clamp, cssVariables, fractionOf, stepped } from "../../src/components/geometry";

const RING = { cx: 40, cy: 40, radius: 32, start: 0, sweep: 360 };

describe("geometry", () => {
  it("clamps and steps without float drift", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(stepped(0.1, 0.2, 0, 1)).toBe(0.3);
    expect(stepped(0.9, 0.2, 0, 1)).toBe(1);
  });

  it("finds a value's fraction of its range, and 0 for an empty range", () => {
    expect(fractionOf(5, 0, 10)).toBe(0.5);
    expect(fractionOf(20, 0, 10)).toBe(1);
    expect(fractionOf(3, 3, 3)).toBe(0);
  });

  it("draws nothing, a small arc, a large arc or a full ring", () => {
    expect(arcPath(0, RING)).toBe("");
    expect(arcPath(0.25, RING)).toBe("M 40.00 8.00 A 32 32 0 0 1 72.00 40.00");
    expect(arcPath(0.75, RING)).toContain(" 0 1 1 ");
    expect(arcPath(1, RING).match(/A /g)).toHaveLength(2);
  });

  it("keeps only the custom properties that have a value", () => {
    expect(cssVariables({ "--ni-tint": "red", "--ni-fill": undefined })).toEqual({
      "--ni-tint": "red",
    });
  });
});

describe("dates", () => {
  it("parses local dates, with or without a time", () => {
    expect(parseLocal("2026-02-28T13:05")).toEqual({
      year: 2026,
      month: 2,
      day: 28,
      hour: 13,
      minute: 5,
    });
    expect(parseLocal("2024-02-29")).toMatchObject({ day: 29, hour: 0, minute: 0 });
  });

  it("rejects dates that are not local dates or do not exist", () => {
    for (const value of ["", "2026-2-1", "2026-13-01", "2026-00-01", "2026-02-29", "2026-01-00"]) {
      expect(parseLocal(value)).toBeUndefined();
    }
    expect(parseLocal("2026-01-01T24:00")).toBeUndefined();
    expect(parseLocal("2026-01-01T12:60")).toBeUndefined();
  });

  it("formats with padding and counts the days of a month", () => {
    expect(formatLocal({ year: 2026, month: 3, day: 4, hour: 5, minute: 6 })).toBe(
      "2026-03-04T05:06",
    );
    expect(daysIn(2024, 2)).toBe(29);
    expect(daysIn(2026, 4)).toBe(30);
  });

  it("lays a month out in weeks starting on Sunday", () => {
    const grid = monthGrid(2026, 11);
    expect(grid[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(grid.at(-1)).toEqual([29, 30, null, null, null, null, null]);
    expect(monthGrid(2026, 10)[0]).toEqual([null, null, null, null, 1, 2, 3]);
  });

  it("moves across months and years, keeping the day within the month", () => {
    const date = { year: 2026, month: 1, day: 31, hour: 9, minute: 0 };
    expect(shiftMonth(date, 1)).toMatchObject({ year: 2026, month: 2, day: 28 });
    expect(shiftMonth(date, -1)).toMatchObject({ year: 2025, month: 12, day: 31 });
  });

  it("describes a date, a time and a month", () => {
    const date = { year: 2026, month: 11, day: 4, hour: 18, minute: 7 };
    expect(describeDate(date, "en-US")).toBe("Nov 4, 2026");
    expect(describeTime(date, "en-US")).toBe("6:07 PM");
    expect(describeMonth(date, "en-US")).toBe("November 2026");
  });
});
