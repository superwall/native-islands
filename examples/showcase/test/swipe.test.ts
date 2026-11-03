import { describe, expect, it } from "bun:test";
import {
  belowOffset,
  completesSwipe,
  EDGE_WIDTH,
  lockAxis,
  startsSwipe,
  swipeProgress,
} from "../src/app/swipe";

describe("swipe back", () => {
  it("starts only at the left edge, and only when there is a screen to go back to", () => {
    expect(startsSwipe(4, true)).toBe(true);
    expect(startsSwipe(EDGE_WIDTH, true)).toBe(true);
    expect(startsSwipe(EDGE_WIDTH + 1, true)).toBe(false);
    expect(startsSwipe(4, false)).toBe(false);
  });

  it("waits for the touch to move before picking an axis", () => {
    expect(lockAxis(3, 2)).toBeUndefined();
    expect(lockAxis(12, 3)).toBe("x");
    expect(lockAxis(3, 12)).toBe("y");
  });

  it("tracks the finger as a share of the width", () => {
    expect(swipeProgress(-20, 400)).toBe(0);
    expect(swipeProgress(100, 400)).toBe(0.25);
    expect(swipeProgress(800, 400)).toBe(1);
    expect(swipeProgress(100, 0)).toBe(0);
  });

  it("slides the screen below in from a third of the way", () => {
    expect(belowOffset(0)).toBeCloseTo(-0.3);
    expect(belowOffset(0.5)).toBeCloseTo(-0.15);
    expect(belowOffset(1)).toBeCloseTo(0);
  });

  it("finishes past halfway, or on a flick either way", () => {
    expect(completesSwipe(0.6, 0)).toBe(true);
    expect(completesSwipe(0.4, 0)).toBe(false);
    expect(completesSwipe(0.1, 0.5)).toBe(true);
    expect(completesSwipe(0.9, -0.5)).toBe(false);
  });
});
