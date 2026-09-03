import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";

const source = {
  orders: [],
  clients: [
    {
      id: "client-1",
      name: "Иван",
      phone: "+7 900 000-00-00",
      createdAt: "2026-09-03T10:00:00.000Z",
    },
  ],
  expenses: [],
  rates: { "Копка траншеи": 2500 },
  shiftRates: { "Копка траншеи": 18000 },
  settings: { shiftHours: 8, deliveryPrice: 3000 },
};

describe("backup", () => {
  it("creates a backup that can be serialized and restored", () => {
    const backup = createBackup(source);
    const restored = parseBackup(JSON.stringify(backup));

    expect(restored.kind).toBe("digger-log-backup");
    expect(restored.version).toBe(1);
    expect(restored.clients).toEqual(source.clients);
    expect(restored.rates).toEqual(source.rates);
    expect(restored.settings).toEqual(source.settings);
  });

  it("rejects unrelated or malformed files", () => {
    expect(() => parseBackup("{}")).toThrow("не резервная копия");
    expect(() => parseBackup(JSON.stringify({ kind: "digger-log-backup", version: 2 }))).toThrow(
      "не поддерживается",
    );
  });
});
