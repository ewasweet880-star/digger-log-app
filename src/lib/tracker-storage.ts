import { useEffect, useRef, useState, useCallback } from "react";
import { isNativeApp, nativeGet, nativeSet } from "./native-store";
import {
  MONTHS_RU,
  WEEKDAYS_RU,
  isSameDay,
  monthGrid,
  parseISODate,
  toISODate,
} from "./date-utils";

export { MONTHS_RU, WEEKDAYS_RU, isSameDay, monthGrid, parseISODate, toISODate };

export type OrderStatus = "planned" | "in_progress" | "done" | "cancelled";

export interface Order {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  workType: string;
  location: string;
  date: string; // ISO date
  hours?: number;
  price: number; // сумма за работу, ₽
  /** Стоимость доставки/подачи техники, ₽ */
  delivery?: number;
  paid: boolean;

  status: OrderStatus;
  notes?: string;
  createdAt: string;
  lat?: number;
  lng?: number;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
}

export type ExpenseCategory = "fuel" | "service" | "parts" | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number; // ₽
  date: string; // ISO yyyy-mm-dd
  /** Литры топлива (для категории «Топливо») */
  liters?: number;
  note?: string;
  orderId?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "fuel", label: "Топливо" },
  { value: "service", label: "Тех. обслуживание" },
  { value: "parts", label: "Запчасти" },
  { value: "other", label: "Прочее" },
];

export function expenseLabel(c: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? "Прочее";
}

const KEY_ORDERS = "excav.orders.v1";
const KEY_EXPENSES = "excav.expenses.v1";
const KEY_CLIENTS = "excav.clients.v1";
const KEY_RATES = "excav.rates.v1";
const KEY_SHIFT_RATES = "excav.shiftRates.v1";
const KEY_SETTINGS = "excav.settings.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
  } catch (err) {
    console.error("Не удалось сохранить данные", err);
  }
  // дублируем в нативное хранилище телефона (Android APK)
  nativeSet(key, raw);
  // асинхронно, чтобы не диспатчить событие во время рендера React
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("excav:storage", { detail: { key } }));
  }, 0);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function useKey<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const ref = useRef<T>(value);
  const hydrated = useRef(false);

  // читаем localStorage только после гидратации
  useEffect(() => {
    const initial = read(key, fallback);
    hydrated.current = true;
    ref.current = initial;
    setValue(initial);

    // В APK localStorage может быть очищен системой — восстанавливаем из
    // нативной памяти телефона, если там есть данные.
    if (!isNativeApp()) return;
    let cancelled = false;
    const hasLocal = Boolean(window.localStorage.getItem(key));
    void nativeGet(key).then((raw) => {
      if (cancelled || !raw) {
        // ничего в нативном хранилище — переносим туда текущие данные
        if (!cancelled && hasLocal) nativeSet(key, JSON.stringify(initial));
        return;
      }
      if (hasLocal) return; // локальные данные актуальны
      try {
        const restored = JSON.parse(raw) as T;
        ref.current = restored;
        setValue(restored);
        window.localStorage.setItem(key, raw);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (detail && detail.key !== key) return;
      const next = read(key, fallback);
      ref.current = next;
      setValue(next);
    };
    window.addEventListener("excav:storage", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("excav:storage", handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const base = hydrated.current ? ref.current : read(key, fallback);
      const next = typeof updater === "function" ? (updater as (p: T) => T)(base) : updater;
      ref.current = next;
      hydrated.current = true;
      write(key, next);
      setValue(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, update] as const;
}

export function useOrders() {
  return useKey<Order[]>(KEY_ORDERS, []);
}

export function useClients() {
  return useKey<Client[]>(KEY_CLIENTS, []);
}

export function useExpenses() {
  return useKey<Expense[]>(KEY_EXPENSES, []);
}

export const WORK_TYPES = [
  "Копка траншеи",
  "Копка котлована",
  "Планировка участка",
  "Погрузка грунта",
  "Погрузка снега",
  "Демонтаж",
  "Корчёвка",
  "Бурение",
  "Перевозка ковшом",
  "Другое",
];

/** Итог по заказу: работа + доставка техники */
export function orderTotal(o: { price?: number; delivery?: number }) {
  return (o.price || 0) + (o.delivery || 0);
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatDate(iso: string) {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

/** Ставка ₽ за час по виду работ */
export type Rates = Record<string, number>;

export function useRates() {
  return useKey<Rates>(KEY_RATES, {});
}

/** Ставка ₽ за смену по виду работ */
export function useShiftRates() {
  return useKey<Rates>(KEY_SHIFT_RATES, {});
}

export interface Settings {
  yandexApiKey?: string;
  yandexGeocoderKey?: string;
  /** Сколько часов в одной смене */
  shiftHours?: number;
  /** Цена подачи (транспортировки) техники по умолчанию, ₽ */
  deliveryPrice?: number;
}

/** Ключ по умолчанию для JavaScript API карт, можно заменить в «Настройках». */
export const DEFAULT_YANDEX_KEY = "29940867-f58f-46d9-8d8f-193828991a6d";

/** Ключ по умолчанию для HTTP Геокодера (адреса по координатам и наоборот). */
export const DEFAULT_GEOCODER_KEY = "22b11243-2abd-4ce0-9957-5e82e6ee5b47";

export function useSettings() {
  return useKey<Settings>(KEY_SETTINGS, {});
}

export function useYandexKey() {
  const [settings] = useSettings();
  return settings.yandexApiKey?.trim() || DEFAULT_YANDEX_KEY;
}

export function useGeocoderKey() {
  const [settings] = useSettings();
  return settings.yandexGeocoderKey?.trim() || DEFAULT_GEOCODER_KEY;
}
