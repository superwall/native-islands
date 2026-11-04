import type * as React from "react";

/** Drawing maths and style helpers for the web versions. */

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/** `value` moved by `by` and kept within `minimum`…`maximum`, without float drift. */
export const stepped = (value: number, by: number, minimum: number, maximum: number): number =>
  clamp(Math.round((value + by) * 1e6) / 1e6, minimum, maximum);

/** Where `value` sits between `minimum` and `maximum`, from 0 to 1. */
export const fractionOf = (value: number, minimum: number, maximum: number): number =>
  maximum > minimum ? clamp((value - minimum) / (maximum - minimum), 0, 1) : 0;

const point = (cx: number, cy: number, radius: number, degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return `${(cx + radius * Math.cos(radians)).toFixed(2)} ${(cy + radius * Math.sin(radians)).toFixed(2)}`;
};

export type Arc = { cx: number; cy: number; radius: number; start: number; sweep: number };

/**
 * An SVG arc from `start` sweeping `sweep` degrees clockwise, 0 at the top,
 * drawn up to `fraction` of the sweep. Empty when there is nothing to draw.
 */
export const arcPath = (fraction: number, { cx, cy, radius, start, sweep }: Arc): string => {
  const drawn = clamp(fraction, 0, 1) * sweep;
  if (drawn <= 0) return "";
  // A full circle needs two arcs: one arc's start and end would be the same point.
  if (drawn >= 360) {
    return `M ${point(cx, cy, radius, start)} A ${radius} ${radius} 0 1 1 ${point(cx, cy, radius, start + 180)} A ${radius} ${radius} 0 1 1 ${point(cx, cy, radius, start)}`;
  }
  const large = drawn > 180 ? 1 : 0;
  return `M ${point(cx, cy, radius, start)} A ${radius} ${radius} 0 ${large} 1 ${point(cx, cy, radius, start + drawn)}`;
};

/** Inline CSS custom properties, leaving out the ones without a value. */
export const cssVariables = (
  values: Readonly<Record<`--${string}`, string | undefined>>,
): React.CSSProperties => {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) style[name] = value;
  }
  return style;
};
