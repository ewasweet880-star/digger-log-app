import { describe, expect, it } from "vitest";
import { mergeSyncData, type SyncPackage } from "./sync";
import type { BackupSource } from "./backup";

const local: BackupSource = {
  orders: [
    {
      id: "local-order",
      clientName: "Иван",
      workType: "Копка",
      location: "",
      date: "2026-09-04",
      price: 1000,
      paid: false,
      status: "planned",
      createdAt: "2026-09-04T08:00:00.000Z",
      updatedAt: "2026-09-04T08:00:00.000Z",
    },
  ],
  clients: [],
  expenses: [],
  rates: { Копка: 100 },
  shiftRates: {},
  settings: {},
};

const incoming: SyncPackage = {
  kind: "smena-sync-package",
  version: 1,
  deviceId: "phone",
  exportedAt: "2026-09-04T10:00:00.000Z",
  orders: [
    {
      ...local.orders[0],
      status: "done",
      updatedAt: "2026-09-04T10:00:00.000Z",
    },
    {
      ...local.orders[0],
      id: "phone-order",
      clientName: "Пётр",
      updatedAt: "2026-09-04T09:00:00.000Z",
    },
  ],
  clients: [],
  expenses: [],
  rates: { Копка: 120 },
  shiftRates: {},
  settings: {},
  attachments: [],
};

describe("sync", () => {
  it("merges records and keeps the newer version of a conflict", () => {
    const merged = mergeSyncData(local, incoming);
    expect(merged.orders).toHaveLength(2);
    expect(merged.orders.find((order) => order.id === "local-order")?.status).toBe("done");
    expect(merged.rates.Копка).toBe(120);
  });
});
