import type { Client, Order } from "./tracker-storage";

export function createCalendarEvent(order: Order) {
  const start = dateTimeForOrder(order);
  const durationHours = Math.max(1, order.hours ?? 1);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  const uid = `${order.id}@smena.app`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Smena//Order tracker//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcs(`${order.workType} — ${order.clientName}`)}`,
    `LOCATION:${escapeIcs(order.location || "")}`,
    `DESCRIPTION:${escapeIcs(order.notes || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function createVCard(client: Client) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(client.name)}`,
    `N:${escapeVCard(client.name)};;;;`,
  ];
  if (client.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(client.phone)}`);
  if (client.note) lines.push(`NOTE:${escapeVCard(client.note)}`);
  lines.push("END:VCARD", "");
  return lines.join("\r\n");
}

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function dateTimeForOrder(order: Order) {
  if (order.startedAt) {
    const started = new Date(order.startedAt);
    if (!Number.isNaN(started.getTime())) return started;
  }
  return new Date(`${order.date}T09:00:00`);
}

function formatUtc(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([,;])/g, "\\$1")
    .replace(/\r?\n/g, "\\n");
}

function escapeVCard(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([,;])/g, "\\$1")
    .replace(/\r?\n/g, "\\n");
}
