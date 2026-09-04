import {
  BACKUP_KIND,
  createCompleteBackup,
  parseBackup,
  type BackupData,
  type BackupSource,
} from "./backup";
import { uid } from "./tracker-storage";
import type { Client, Expense, Order, Rates, Settings } from "./tracker-storage";

export const SYNC_KIND = "smena-sync-package";
export const SYNC_VERSION = 1;
const DEVICE_KEY = "smena.device-id";

export interface SyncPackage extends Omit<BackupData, "kind" | "version"> {
  kind: typeof SYNC_KIND;
  version: typeof SYNC_VERSION;
  deviceId: string;
}

export type SyncSource = BackupSource;

export async function createSyncPackage(source: SyncSource): Promise<SyncPackage> {
  const backup = await createCompleteBackup(source);
  return {
    ...backup,
    kind: SYNC_KIND,
    version: SYNC_VERSION,
    deviceId: getDeviceId(),
  };
}

export function parseSyncPackage(text: string): SyncPackage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Файл синхронизации не является корректным JSON.");
  }
  if (!isRecord(value) || value.kind !== SYNC_KIND || value.version !== SYNC_VERSION) {
    throw new Error("Это не пакет синхронизации «Смена».");
  }
  if (typeof value.deviceId !== "string" || !value.deviceId) {
    throw new Error("В пакете синхронизации отсутствует устройство-источник.");
  }

  const normalized = { ...value, kind: BACKUP_KIND };
  const backup = parseBackup(JSON.stringify(normalized));
  return {
    ...backup,
    kind: SYNC_KIND,
    version: SYNC_VERSION,
    deviceId: value.deviceId,
  };
}

export function mergeSyncData(local: SyncSource, incoming: SyncPackage): SyncSource {
  return {
    orders: mergeRecords(local.orders, incoming.orders),
    clients: mergeRecords(local.clients, incoming.clients),
    expenses: mergeRecords(local.expenses, incoming.expenses),
    rates: { ...local.rates, ...incoming.rates },
    shiftRates: { ...local.shiftRates, ...incoming.shiftRates },
    settings: { ...local.settings, ...incoming.settings },
  };
}

export function getDeviceId() {
  if (typeof window === "undefined") return "server";
  try {
    const saved = window.localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = uid();
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return uid();
  }
}

function mergeRecords<T extends { id: string; createdAt: string; updatedAt?: string }>(
  local: T[],
  incoming: T[],
) {
  const result = new Map(local.map((item) => [item.id, item]));
  for (const item of incoming) {
    const current = result.get(item.id);
    if (!current || recordTime(item) >= recordTime(current)) result.set(item.id, item);
  }
  return Array.from(result.values());
}

function recordTime(record: { createdAt: string; updatedAt?: string }) {
  const time = Date.parse(record.updatedAt ?? record.createdAt);
  return Number.isNaN(time) ? 0 : time;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SyncCollections = {
  orders: Order[];
  clients: Client[];
  expenses: Expense[];
  rates: Rates;
  shiftRates: Rates;
  settings: Settings;
};
