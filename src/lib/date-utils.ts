/** Date-only helpers. All dates are interpreted in the user's local timezone. */

export const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/**
 * Parse a yyyy-MM-dd value without going through UTC.
 * `new Date("2026-09-03")` is UTC-based and can become the previous day
 * in browsers with a negative timezone offset.
 */
export function parseISODate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(Number.NaN);

  const [, year, month, day] = match;
  const result = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    result.getFullYear() !== Number(year) ||
    result.getMonth() !== Number(month) - 1 ||
    result.getDate() !== Number(day)
  ) {
    return new Date(Number.NaN);
  }
  return result;
}

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isDateInRange(iso: string, start: Date, endExclusive: Date) {
  const date = parseISODate(iso);
  return !Number.isNaN(date.getTime()) && date >= start && date < endExclusive;
}

export function getMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, endExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

export function getWeekRange(now = new Date()) {
  const start = startOfDay(now);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return {
    start,
    endExclusive: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7),
  };
}

/** Month grid with Monday as the first day of the week. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
