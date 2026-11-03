/** How close to the left edge a touch must start to swipe back, as on iOS. */
export const EDGE_WIDTH = 24;

/** How far a touch moves before the swipe decides whether it is horizontal. */
export const AXIS_SLOP = 8;

/** How far the screen below sits to the left while it is covered, as a share of the width. */
export const BELOW_SHIFT = 0.3;

export const startsSwipe = (x: number, canGoBack: boolean): boolean =>
  canGoBack && x >= 0 && x <= EDGE_WIDTH;

/** `x` once the touch clearly moves sideways, `y` once it clearly scrolls, undefined until then. */
export const lockAxis = (dx: number, dy: number): "x" | "y" | undefined => {
  if (Math.hypot(dx, dy) < AXIS_SLOP) return undefined;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
};

export const swipeProgress = (dx: number, width: number): number =>
  width > 0 ? Math.min(1, Math.max(0, dx / width)) : 0;

/** The screen below's offset, as a share of the width, for a swipe that has gone `progress` of the way. */
export const belowOffset = (progress: number): number => -BELOW_SHIFT * (1 - progress);

/**
 * Whether letting go finishes the swipe: a flick either way decides it, and
 * a slow release goes back past the middle. `velocity` is in points per ms.
 */
export const completesSwipe = (progress: number, velocity: number): boolean => {
  if (velocity > 0.3) return true;
  if (velocity < -0.3) return false;
  return progress > 0.5;
};
