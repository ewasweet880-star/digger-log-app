import type { Expense, Order } from "./tracker-storage";
import {
  getMonthRange,
  getWeekRange,
  isDateInRange,
  parseISODate,
  startOfDay,
  toISODate,
} from "./date-utils";

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

export interface DailyReport {
  date: string;
  scheduledCount: number;
  plannedCount: number;
  inProgressCount: number;
  completedCount: number;
  earned: number;
  received: number;
  toReceive: number;
  hours: number;
  expenses: number;
  fuelExpenses: number;
  net: number;
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
        result.hoursMonth += order.actualHours ?? order.hours ?? 0;
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

export function calculateDailyReport(
  orders: Order[],
  expenses: Expense[],
  now = new Date(),
): DailyReport {
  const date = toISODate(now);
  const report: DailyReport = {
    date,
    scheduledCount: 0,
    plannedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    earned: 0,
    received: 0,
    toReceive: 0,
    hours: 0,
    expenses: 0,
    fuelExpenses: 0,
    net: 0,
  };

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const amount = orderAmount(order);
    if (order.date === date) {
      report.scheduledCount += 1;
      if (order.status === "planned") report.plannedCount += 1;
      if (order.status === "in_progress") report.inProgressCount += 1;
    }

    if (wasCompletedOn(order, date)) {
      report.completedCount += 1;
      report.earned += amount;
      report.hours += order.actualHours ?? order.hours ?? 0;
      if (!order.paid) report.toReceive += amount;
    }

    if (order.paid && wasPaidOn(order, date)) report.received += amount;
  }

  for (const expense of expenses) {
    if (expense.date !== date) continue;
    report.expenses += expense.amount || 0;
    if (expense.category === "fuel") report.fuelExpenses += expense.amount || 0;
  }
  report.net = report.earned - report.expenses;
  return report;
}

function wasCompletedOn(order: Order, date: string) {
  return (
    order.status === "done" &&
    (timestampIsOnDay(order.completedAt, date) || (!order.completedAt && order.date === date))
  );
}

function wasPaidOn(order: Order, date: string) {
  return timestampIsOnDay(order.paidAt, date) || (!order.paidAt && order.date === date);
}

function timestampIsOnDay(timestamp: string | undefined, date: string) {
  if (!timestamp) return false;
  const parsed = new Date(timestamp);
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === date;
}
