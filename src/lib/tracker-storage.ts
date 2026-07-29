import { useEffect, useRef, useState, useCallback } from "react";

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

const KEY_ORDERS = "excav.orders.v1";
const KEY_CLIENTS = "excav.clients.v1";
const KEY_RATES = "excav.rates.v1";
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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Не удалось сохранить данные", err);
  }
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
      const next =
        typeof updater === "function" ? (updater as (p: T) => T)(base) : updater;
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
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Ставка ₽ за час по виду работ */
export type Rates = Record<string, number>;

export function useRates() {
  return useKey<Rates>(KEY_RATES, {});
}

export interface Settings {
  yandexApiKey?: string;
  yandexGeocoderKey?: string;
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


export const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Сетка месяца: 6 недель по 7 дней, начиная с понедельника */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
