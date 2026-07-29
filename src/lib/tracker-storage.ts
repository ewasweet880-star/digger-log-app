import { useEffect, useState, useCallback } from "react";

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
  price: number; // total rubles
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
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("excav:storage", { detail: { key } }));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function useKey<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (!detail || detail.key === key) setValue(read(key, fallback));
    };
    window.addEventListener("excav:storage", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("excav:storage", handler);
      window.removeEventListener("storage", handler);
    };
  }, [key]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        write(key, next);
        return next;
      });
    },
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
