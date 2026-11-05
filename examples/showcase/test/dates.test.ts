import { describe, expect, it } from "bun:test";
import { formatLocal } from "../src/ui/dates";

describe("formatLocal", () => {
  it("writes a date's local fields, padded", () => {
    expect(formatLocal(new Date(2026, 0, 9, 8, 4))).toBe("2026-01-09T08:04");
    expect(formatLocal(new Date(2026, 10, 30, 23, 59))).toBe("2026-11-30T23:59");
  });
});
