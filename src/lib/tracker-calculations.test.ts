import { describe, expect, it } from "vitest";
import { calculateEarnings } from "./tracker-calculations";
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
