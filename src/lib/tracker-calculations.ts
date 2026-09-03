import type { Expense, Order } from "./tracker-storage";
import { getMonthRange, getWeekRange, isDateInRange, parseISODate, startOfDay } from "./date-utils";

export interface EarningsSummary {
  /** Amount for completed orders dated in the current month. */
  earnedMonth: number;
  /** Amount for completed orders dated in the current Monday-Sunday week. */
  earnedWeek: number;
  /** All non-cancelled orders scheduled for the current month. */
  scheduledMonth: number;
  /** Amount marked as paid for non-cancelled orders dated this month. */
  receivedMonth: number;
  /** Completed but unpaid orders, regardless of their date. */
  toReceive: number;
  /** Planned orders from today onwards. */
  planned: number;
  /** All non-cancelled order amounts. */
  total: number;
  /** Hours for completed orders dated this month. */
  hoursMonth: number;
  /** Number of completed orders. */
  doneCount: number;
  expensesMonth: number;
  fuelMonth: number;
  serviceMonth: number;
}

export function orderAmount(order: Pick<Order, "price" | "delivery">) {
  return (order.price || 0) + (order.delivery || 0);
}

export function calculateEarnings(
  orders: Order[],
  expenses: Expense[],
  now = new Date(),
): EarningsSummary {
  const month = getMonthRange(now);
  const week = getWeekRange(now);
  const today = startOfDay(now);

  const result: EarningsSummary = {
    earnedMonth: 0,
    earnedWeek: 0,
    scheduledMonth: 0,
    receivedMonth: 0,
    toReceive: 0,
    planned: 0,
    total: 0,
    hoursMonth: 0,
    doneCount: 0,
    expensesMonth: 0,
    fuelMonth: 0,
    serviceMonth: 0,
  };

  for (const order of orders) {
    if (order.status === "cancelled") continue;

    const amount = orderAmount(order);
    const date = parseISODate(order.date);
    result.total += amount;

    if (order.status === "done") {
      result.doneCount += 1;
      if (isDateInRange(order.date, month.start, month.endExclusive)) {
        result.earnedMonth += amount;
        result.hoursMonth += order.hours || 0;
      }
      if (isDateInRange(order.date, week.start, week.endExclusive)) {
        result.earnedWeek += amount;
      }
      if (!order.paid) result.toReceive += amount;
    }

    if (isDateInRange(order.date, month.start, month.endExclusive)) {
      result.scheduledMonth += amount;
      if (order.paid) result.receivedMonth += amount;
    }

    if (order.status === "planned" && !Number.isNaN(date.getTime()) && date >= today) {
      result.planned += amount;
    }
  }

  for (const expense of expenses) {
    if (!isDateInRange(expense.date, month.start, month.endExclusive)) continue;
    result.expensesMonth += expense.amount || 0;
    if (expense.category === "fuel") result.fuelMonth += expense.amount || 0;
    if (expense.category === "service" || expense.category === "parts") {
      result.serviceMonth += expense.amount || 0;
    }
  }

  return result;
}
