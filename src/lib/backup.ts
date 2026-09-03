import type { Client, Expense, Order, Rates, Settings } from "./tracker-storage";
import { parseISODate } from "./date-utils";

export const BACKUP_KIND = "digger-log-backup";
export const BACKUP_VERSION = 1;

export interface BackupData {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  orders: Order[];
  clients: Client[];
  expenses: Expense[];
  rates: Rates;
  shiftRates: Rates;
  settings: Settings;
}

export interface BackupSource {
  orders: Order[];
  clients: Client[];
  expenses: Expense[];
  rates: Rates;
  shiftRates: Rates;
  settings: Settings;
}

export function createBackup(source: BackupSource): BackupData {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // Copies ensure later state changes cannot mutate the object that is about
    // to be serialized.
    orders: source.orders.map((order) => ({ ...order })),
    clients: source.clients.map((client) => ({ ...client })),
    expenses: source.expenses.map((expense) => ({ ...expense })),
    rates: { ...source.rates },
    shiftRates: { ...source.shiftRates },
    settings: { ...source.settings },
  };
}

export function parseBackup(text: string): BackupData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Файл не является корректным JSON.");
  }

  if (!isRecord(value) || value.kind !== BACKUP_KIND) {
    throw new Error("Это не резервная копия приложения «Смена».");
  }
  if (value.version !== BACKUP_VERSION) {
    throw new Error(`Версия резервной копии не поддерживается: ${String(value.version)}.`);
  }

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
    orders: readArray(value.orders, isOrder, "заказы"),
    clients: readArray(value.clients, isClient, "клиенты"),
    expenses: readArray(value.expenses, isExpense, "расходы"),
    rates: readRates(value.rates, "ставки за час"),
    shiftRates: readRates(value.shiftRates, "ставки за смену"),
    settings: readSettings(value.settings),
  };
}

function readArray<T>(value: unknown, guard: (item: unknown) => item is T, label: string) {
  if (!Array.isArray(value) || !value.every(guard)) {
    throw new Error(`В резервной копии повреждены данные: ${label}.`);
  }
  return value;
}

function readRates(value: unknown, label: string): Rates {
  if (!isRecord(value)) throw new Error(`В резервной копии повреждены данные: ${label}.`);
  for (const [name, amount] of Object.entries(value)) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`В резервной копии повреждены данные: ${label}.`);
    }
    if (!name.trim()) throw new Error(`В резервной копии повреждены данные: ${label}.`);
  }
  return value as Rates;
}

function readSettings(value: unknown): Settings {
  if (!isRecord(value)) throw new Error("В резервной копии повреждены настройки.");
  const settings: Settings = {};
  for (const key of ["yandexApiKey", "yandexGeocoderKey"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error("В резервной копии повреждены настройки.");
    }
    if (typeof value[key] === "string") settings[key] = value[key];
  }
  for (const key of ["shiftHours", "deliveryPrice"] as const) {
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0)
    ) {
      throw new Error("В резервной копии повреждены настройки.");
    }
    if (typeof value[key] === "number") settings[key] = value[key];
  }
  return settings;
}

const ORDER_STATUSES = new Set<Order["status"]>(["planned", "in_progress", "done", "cancelled"]);
const EXPENSE_CATEGORIES = new Set<Expense["category"]>(["fuel", "service", "parts", "other"]);

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.clientName === "string" &&
    typeof value.workType === "string" &&
    typeof value.location === "string" &&
    isISODate(value.date) &&
    isNonNegativeNumber(value.price) &&
    typeof value.paid === "boolean" &&
    typeof value.status === "string" &&
    ORDER_STATUSES.has(value.status as Order["status"]) &&
    typeof value.createdAt === "string" &&
    isOptionalString(value.clientId) &&
    isOptionalString(value.clientPhone) &&
    isOptionalNumber(value.hours) &&
    isOptionalNumber(value.delivery) &&
    isOptionalString(value.notes) &&
    isOptionalFiniteNumber(value.lat) &&
    isOptionalFiniteNumber(value.lng)
  );
}

function isClient(value: unknown): value is Client {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    isOptionalString(value.phone) &&
    isOptionalString(value.note)
  );
}

function isExpense(value: unknown): value is Expense {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.category === "string" &&
    EXPENSE_CATEGORIES.has(value.category as Expense["category"]) &&
    isNonNegativeNumber(value.amount) &&
    isISODate(value.date) &&
    typeof value.createdAt === "string" &&
    isOptionalNumber(value.liters) &&
    isOptionalString(value.note) &&
    isOptionalString(value.orderId)
  );
}

function isISODate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(parseISODate(value).getTime());
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNonNegativeNumber(value);
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
