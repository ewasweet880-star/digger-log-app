import { describe, expect, it } from "vitest";
import { calculateDailyReport, calculateEarnings } from "./tracker-calculations";
import type { Expense, Order } from "./tracker-storage";

const now = new Date(2026, 8, 3, 12); // Thursday, 3 September 2026

function order(overrides: Partial<Order>): Order {
  return {
    id: Math.random().toString(),
    clientName: "Иван",
    workType: "Копка траншеи",
    location: "",
    date: "2026-09-03",
    price: 1000,
    paid: false,
    status: "done",
    createdAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(),
    category: "fuel",
    amount: 100,
    date: "2026-09-03",
    createdAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("calculateEarnings", () => {
  it("counts only completed orders inside the current month", () => {
    const summary = calculateEarnings(
      [
        order({ id: "start", date: "2026-09-01", price: 1000 }),
        order({ id: "end", date: "2026-09-30", price: 2000, paid: true }),
        order({ id: "before", date: "2026-08-31", price: 3000 }),
        order({ id: "after", date: "2026-10-01", price: 4000 }),
        order({ id: "planned", date: "2026-09-15", price: 5000, status: "planned" }),
        order({ id: "cancelled", date: "2026-09-15", price: 6000, status: "cancelled" }),
      ],
      [expense({ amount: 250 })],
      now,
    );

    expect(summary.earnedMonth).toBe(3000);
    expect(summary.scheduledMonth).toBe(8000);
    expect(summary.receivedMonth).toBe(2000);
    expect(summary.total).toBe(15000);
    expect(summary.planned).toBe(5000);
    expect(summary.expensesMonth).toBe(250);
    expect(summary.toReceive).toBe(8000);
  });

  it("limits the weekly total to Monday through Sunday", () => {
    const summary = calculateEarnings(
      [
        order({ id: "monday", date: "2026-08-31", price: 1000 }),
        order({ id: "sunday", date: "2026-09-06", price: 2000 }),
        order({ id: "next-monday", date: "2026-09-07", price: 4000 }),
        order({ id: "previous-sunday", date: "2026-08-30", price: 8000 }),
      ],
      [],
      now,
    );

    expect(summary.earnedWeek).toBe(3000);
  });

  it("does not include future planned work in the current month or invalid dates", () => {
    const summary = calculateEarnings(
      [
        order({ id: "future", date: "2027-09-03", price: 9000, status: "planned" }),
        order({ id: "invalid", date: "not-a-date", price: 9000, status: "planned" }),
      ],
      [],
      now,
    );

    expect(summary.scheduledMonth).toBe(0);
    expect(summary.planned).toBe(9000);
  });
});

describe("calculateDailyReport", () => {
  it("uses completion and payment timestamps for the daily workflow", () => {
    const report = calculateDailyReport(
      [
        order({
          id: "finished-today",
          date: "2026-09-03",
          price: 2000,
          actualHours: 3,
          completedAt: "2026-09-03T11:00:00",
          paid: true,
          paidAt: "2026-09-03T12:00:00",
        }),
        order({
          id: "overdue-finished-today",
          date: "2026-09-02",
          price: 3000,
          actualHours: 2,
          completedAt: "2026-09-03T17:00:00",
        }),
        order({
          id: "in-progress",
          date: "2026-09-03",
          price: 4000,
          status: "in_progress",
        }),
        order({
          id: "planned",
          date: "2026-09-03",
          price: 5000,
          status: "planned",
        }),
        order({
          id: "cancelled",
          date: "2026-09-03",
          price: 6000,
          status: "cancelled",
        }),
      ],
      [expense({ date: "2026-09-03", amount: 500 })],
      now,
    );

    expect(report.scheduledCount).toBe(3);
    expect(report.plannedCount).toBe(1);
    expect(report.inProgressCount).toBe(1);
    expect(report.completedCount).toBe(2);
    expect(report.earned).toBe(5000);
    expect(report.received).toBe(2000);
    expect(report.toReceive).toBe(3000);
    expect(report.hours).toBe(5);
    expect(report.expenses).toBe(500);
    expect(report.net).toBe(4500);
  });
});
