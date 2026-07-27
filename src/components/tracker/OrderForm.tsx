import { useState } from "react";
import {
  useClients,
  useOrders,
  uid,
  WORK_TYPES,
  type Order,
  type OrderStatus,
} from "@/lib/tracker-storage";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  editing?: Order;
}

export function OrderForm({ onClose, editing }: Props) {
  const [, setOrders] = useOrders();
  const [clients, setClients] = useClients();

  const [clientName, setClientName] = useState(editing?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(editing?.clientPhone ?? "");
  const [workType, setWorkType] = useState(editing?.workType ?? WORK_TYPES[0]);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [date, setDate] = useState(
    editing?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [hours, setHours] = useState(editing?.hours?.toString() ?? "");
  const [price, setPrice] = useState(editing?.price?.toString() ?? "");
  const [status, setStatus] = useState<OrderStatus>(editing?.status ?? "planned");
  const [paid, setPaid] = useState(editing?.paid ?? false);
  const [notes, setNotes] = useState(editing?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;

    // upsert client
    let clientId = editing?.clientId;
    const existing = clients.find(
      (c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase(),
    );
    if (existing) {
      clientId = existing.id;
      if (clientPhone && existing.phone !== clientPhone) {
        setClients((prev) =>
          prev.map((c) => (c.id === existing.id ? { ...c, phone: clientPhone } : c)),
        );
      }
    } else {
      clientId = uid();
      setClients((prev) => [
        ...prev,
        {
          id: clientId!,
          name: clientName.trim(),
          phone: clientPhone || undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    const order: Order = {
      id: editing?.id ?? uid(),
      clientId,
      clientName: clientName.trim(),
      clientPhone: clientPhone || undefined,
      workType,
      location: location.trim(),
      date,
      hours: hours ? Number(hours) : undefined,
      price: price ? Number(price) : 0,
      paid,
      status,
      notes: notes || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };

    setOrders((prev) =>
      editing ? prev.map((o) => (o.id === editing.id ? order : o)) : [order, ...prev],
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-card border-t sm:border border-border shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
          <h2 className="font-display text-xl uppercase tracking-wide">
            {editing ? "Редактировать" : "Новый заказ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Field label="Клиент *">
            <input
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              list="clients-list"
              className="input"
              placeholder="Имя клиента"
            />
            <datalist id="clients-list">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>

          <Field label="Телефон">
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="input"
              placeholder="+7 ..."
            />
          </Field>

          <Field label="Вид работ">
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="input"
            >
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Место работы">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              placeholder="Адрес / ориентир"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Часы">
              <input
                type="number"
                min="0"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Сумма, ₽">
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input text-lg font-bold"
              placeholder="0"
            />
          </Field>

          <Field label="Статус">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["planned", "Запланирован"],
                  ["in_progress", "В работе"],
                  ["done", "Выполнен"],
                  ["cancelled", "Отменён"],
                ] as [OrderStatus, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatus(v)}
                  className={`py-2 rounded-lg text-sm font-medium border transition ${
                    status === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="size-5 accent-primary"
            />
            <span className="font-medium">Оплачено</span>
          </label>

          <Field label="Заметки">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-20"
              placeholder="Дополнительно..."
            />
          </Field>
        </div>

        <div className="sticky bottom-0 p-4 bg-card border-t border-border flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}
