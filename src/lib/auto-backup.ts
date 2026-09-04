import { useEffect, useState } from "react";
import { createCompleteBackup, type BackupData, type BackupSource } from "./backup";

const DB_NAME = "smena-backups";
const STORE_NAME = "automatic";
const FALLBACK_KEY = "smena.automatic-backups.v1";
const KEEP_COUNT = 5;

export interface AutomaticBackupInfo {
  id: string;
  createdAt: string;
  size: number;
}

interface AutomaticBackup extends AutomaticBackupInfo {
  data: BackupData;
}

let databasePromise: Promise<IDBDatabase | null> | undefined;

export function useAutoBackup(source: BackupSource) {
  const { orders, clients, expenses, rates, shiftRates, settings } = source;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLatestAutomaticBackup()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void createCompleteBackup({ orders, clients, expenses, rates, shiftRates, settings })
        .then((backup) => saveAutomaticBackup(backup))
        .catch((error) => console.warn("Не удалось создать автокопию", error));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [ready, orders, clients, expenses, rates, shiftRates, settings]);
}

export function useLatestAutomaticBackup() {
  const [backup, setBackup] = useState<AutomaticBackupInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getLatestAutomaticBackup()
        .catch(() => null)
        .then((latest) => {
          if (!cancelled) setBackup(latest ? toInfo(latest) : null);
        });
    };
    refresh();
    window.addEventListener("smena:auto-backup", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("smena:auto-backup", refresh);
    };
  }, []);

  return backup;
}

export async function getLatestAutomaticBackup() {
  const all = await getAutomaticBackups();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export async function getAutomaticBackups() {
  const database = await openDatabase();
  if (!database) return readFallback();
  return request<AutomaticBackup[]>(database, "readonly", (store) => store.getAll());
}

export async function saveAutomaticBackup(data: BackupData) {
  const json = JSON.stringify(data);
  const record: AutomaticBackup = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    size: json.length,
    data,
  };
  const database = await openDatabase();
  if (!database) {
    const next = [record, ...readFallback()].slice(0, KEEP_COUNT);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(next));
  } else {
    await request(database, "readwrite", (store) => store.put(record));
    const all = await getAutomaticBackups();
    const stale = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(KEEP_COUNT);
    await Promise.all(
      stale.map((item) => request(database, "readwrite", (store) => store.delete(item.id))),
    );
  }
  window.dispatchEvent(new CustomEvent("smena:auto-backup"));
  return toInfo(record);
}

export async function restoreLatestAutomaticBackup() {
  const latest = await getLatestAutomaticBackup();
  return latest?.data ?? null;
}

function toInfo(record: AutomaticBackup): AutomaticBackupInfo {
  return { id: record.id, createdAt: record.createdAt, size: record.size };
}

function readFallback() {
  if (typeof localStorage === "undefined") return [] as AutomaticBackup[];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]");
    return Array.isArray(value) ? (value as AutomaticBackup[]) : [];
  } catch {
    return [];
  }
}

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return databasePromise;
}

function request<T = unknown>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
