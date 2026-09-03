import { describe, expect, it } from "vitest";
import { getMonthRange, getWeekRange, parseISODate, toISODate } from "./date-utils";

describe("date-only helpers", () => {
  it("round-trips a date without applying a timezone offset", () => {
    const date = parseISODate("2026-09-03");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(3);
    expect(toISODate(date)).toBe("2026-09-03");
  });

  it("returns exact local month and week boundaries", () => {
    const now = new Date(2026, 8, 3, 12); // Thursday
    const month = getMonthRange(now);
    const week = getWeekRange(now);

    expect(toISODate(month.start)).toBe("2026-09-01");
    expect(toISODate(month.endExclusive)).toBe("2026-10-01");
    expect(toISODate(week.start)).toBe("2026-08-31");
    expect(toISODate(week.endExclusive)).toBe("2026-09-07");
  });

  it("rejects impossible calendar dates", () => {
    expect(Number.isNaN(parseISODate("2026-02-30").getTime())).toBe(true);
  });
});
