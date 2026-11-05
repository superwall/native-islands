/** Drawing maths for the chart's web version. */

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** A round axis maximum at or above the largest value: 1, 2 or 5 times a power of ten. */
export const niceMaximum = (values: readonly number[]): number => {
  const largest = Math.max(0, ...values);
  if (largest === 0) return 1;
  const power = 10 ** Math.floor(Math.log10(largest));
  const step = [1, 2, 5, 10].find((factor) => factor * power >= largest) ?? 10;
  return step * power;
};

/** The index of the slot under `x` when `count` equal slots fill `width`. */
export const slotAt = (x: number, width: number, count: number): number | undefined => {
  if (count <= 0 || width <= 0 || x < 0 || x > width) return;
  return clamp(Math.floor((x / width) * count), 0, count - 1);
};
