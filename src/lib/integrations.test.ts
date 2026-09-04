import { describe, expect, it } from "vitest";
import { createCalendarEvent, createVCard } from "./integrations";
import type { Client, Order } from "./tracker-storage";

const order: Order = {
  id: "order-1",
  clientName: "Иван; Петров",
  workType: "Копка траншеи",
  location: "Москва, ул. Тестовая, 1",
  date: "2026-09-04",
  hours: 4,
  price: 1000,
  paid: false,
  status: "planned",
  createdAt: "2026-09-04T08:00:00.000Z",
};

const client: Client = {
  id: "client-1",
  name: "Иван; Петров",
  phone: "+7 900 000-00-00",
  createdAt: "2026-09-04T08:00:00.000Z",
};

describe("device integrations", () => {
  it("creates a calendar event that escapes user text", () => {
    const calendar = createCalendarEvent(order);
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("SUMMARY:Копка траншеи — Иван\\; Петров");
    expect(calendar).toContain("END:VCALENDAR");
  });

  it("creates a contact card", () => {
    const vcard = createVCard(client);
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("TEL;TYPE=CELL:+7 900 000-00-00");
    expect(vcard).toContain("Иван\\; Петров");
    expect(vcard).toContain("END:VCARD");
  });
});
