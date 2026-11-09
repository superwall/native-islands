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

/** A round axis maximum at or above the largest value: 1, 2 or 5 times a power of ten. */
export const niceMaximum = (values: readonly number[]): number => {
  const largest = Math.max(0, ...values);
  if (largest === 0) return 1;
  const power = 10 ** Math.floor(Math.log10(largest));
  const step = [1, 2, 5].find((factor) => factor * power >= largest) ?? 10;
  return step * power;
};

/** The index of the slot under `x` when `count` equal slots fill `width`. */
export const slotAt = (x: number, width: number, count: number): number | undefined => {
  if (count <= 0 || width <= 0 || x < 0 || x > width) return;
  return clamp(Math.floor((x / width) * count), 0, count - 1);
};

/**
 * Where each place sits on the map's web version, as percentages of its box:
 * the places' bounding box fitted inside `margin` of each edge, north up.
 */
export const projectPlaces = (
  places: readonly { id: string; latitude: number; longitude: number }[],
  margin = 15,
): { id: string; x: number; y: number }[] => {
  if (places.length === 0) return [];
  const latitudes = places.map((place) => place.latitude);
  const longitudes = places.map((place) => place.longitude);
  const [south, north] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [west, east] = [Math.min(...longitudes), Math.max(...longitudes)];
  const span = 100 - margin * 2;
  const along = (value: number, low: number, high: number) =>
    high === low ? 50 : margin + ((value - low) / (high - low)) * span;
  return places.map((place) => ({
    id: place.id,
    x: along(place.longitude, west, east),
    y: 100 - along(place.latitude, south, north),
  }));
};
