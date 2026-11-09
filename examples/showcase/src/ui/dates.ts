/** Dates cross the bridge as local `yyyy-MM-ddTHH:mm`, the format of the date picker. */

const pad = (value: number) => String(value).padStart(2, "0");

/** A `Date` as local `yyyy-MM-ddTHH:mm`. */
export const formatLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
