/**
 * Dates cross the bridge as local `yyyy-MM-ddTHH:mm`, the format of
 * `<input type="datetime-local">` and of the native date picker.
 */

export type LocalDate = {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export const parseLocal = (value: string): LocalDate | undefined => {
  const match = LOCAL.exec(value);
  if (!match) return;
  const [year, month, day, hour, minute] = match.slice(1).map((part) => Number(part ?? 0));
  if (year === undefined || month === undefined || day === undefined) return;
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return;
  if ((hour ?? 0) > 23 || (minute ?? 0) > 59) return;
  return { year, month, day, hour: hour ?? 0, minute: minute ?? 0 };
};

export const formatLocal = ({ year, month, day, hour, minute }: LocalDate): string =>
  `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;

export const localOf = (date: Date): LocalDate => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  hour: date.getHours(),
  minute: date.getMinutes(),
});

export const daysIn = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The weekday of the first of the month, 0 for Sunday. */
const firstWeekday = (year: number, month: number): number =>
  new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

/** A month as calendar rows of seven: day numbers, with `null` before the 1st and after the last. */
export const monthGrid = (year: number, month: number): (number | null)[][] => {
  const cells: (number | null)[] = Array.from({ length: firstWeekday(year, month) }, () => null);
  for (let day = 1; day <= daysIn(year, month); day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
  return rows;
};

/** The month before or after, keeping the day within it. */
export const shiftMonth = (date: LocalDate, by: number): LocalDate => {
  const index = date.year * 12 + (date.month - 1) + by;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { ...date, year, month, day: Math.min(date.day, daysIn(year, month)) };
};

const toDate = ({ year, month, day, hour, minute }: LocalDate) =>
  new Date(year, month - 1, day, hour, minute);

export const describeDate = (date: LocalDate, locale?: string): string =>
  toDate(date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

export const describeTime = (date: LocalDate, locale?: string): string =>
  toDate(date).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

export const describeMonth = (date: LocalDate, locale?: string): string =>
  toDate(date).toLocaleDateString(locale, { month: "long", year: "numeric" });
