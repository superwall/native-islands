import { describe, expect, it } from "bun:test";
import { daysIn, formatLocal, localOf, monthGrid, parseLocal, shiftMonth } from "../src/ui/dates";

describe("parseLocal", () => {
  it("reads a local date and time", () => {
    expect(parseLocal("2026-11-03T14:05")).toEqual({
      year: 2026,
      month: 11,
      day: 3,
      hour: 14,
      minute: 5,
    });
  });

  it("reads a date alone as midnight", () => {
    expect(parseLocal("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28, hour: 0, minute: 0 });
  });

  it("refuses what is not a real date or time", () => {
    for (const value of [
      "",
      "2026-13-01",
      "2026-02-29",
      "2026-04-31",
      "2026-01-01T24:00",
      "2026-01-01T09:60",
      "3 Nov",
    ]) {
      expect(parseLocal(value)).toBeUndefined();
    }
  });

  it("round-trips through formatLocal", () => {
    expect(formatLocal(parseLocal("2028-02-29T07:30") ?? localOf(new Date()))).toBe(
      "2028-02-29T07:30",
    );
  });
});

describe("localOf", () => {
  it("takes the local fields of a date", () => {
    expect(formatLocal(localOf(new Date(2026, 0, 9, 8, 4)))).toBe("2026-01-09T08:04");
  });
});

describe("daysIn", () => {
  it("knows month lengths and leap years", () => {
    expect([
      daysIn(2026, 1),
      daysIn(2026, 2),
      daysIn(2028, 2),
      daysIn(2026, 4),
      daysIn(2100, 2),
    ]).toEqual([31, 28, 29, 30, 28]);
  });
});

describe("monthGrid", () => {
  it("starts November 2026 on its Sunday", () => {
    const rows = monthGrid(2026, 11);
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows.at(-1)).toEqual([29, 30, null, null, null, null, null]);
  });

  it("pads before the 1st and fills whole weeks", () => {
    const rows = monthGrid(2026, 2);
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows).toHaveLength(4);
    const january = monthGrid(2026, 1);
    expect(january[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(january.every((row) => row.length === 7)).toBe(true);
    expect(january.flat().filter((day) => day !== null)).toHaveLength(31);
  });
});

describe("shiftMonth", () => {
  const jan31 = { year: 2026, month: 1, day: 31, hour: 9, minute: 0 };

  it("moves across years both ways", () => {
    expect(shiftMonth({ ...jan31, day: 15 }, -1)).toMatchObject({ year: 2025, month: 12, day: 15 });
    expect(shiftMonth({ ...jan31, month: 12, day: 15 }, 1)).toMatchObject({ year: 2027, month: 1 });
  });

  it("keeps the day within a shorter month", () => {
    expect(shiftMonth(jan31, 1)).toMatchObject({ month: 2, day: 28, hour: 9 });
  });
});
