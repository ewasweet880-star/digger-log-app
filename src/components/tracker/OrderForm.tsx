import { useEffect, useState } from "react";
import {
  useClients,
  useOrders,
  useRates,
  useShiftRates,
  useSettings,
  uid,
  formatMoney,
  WORK_TYPES,
  toISODate,
  type Order,
  type OrderStatus,
} from "@/lib/tracker-storage";
import { DatePicker } from "./DatePicker";
import { YandexMap } from "./YandexMap";
import { ChevronDown, Map as MapIcon, X } from "lucide-react";
import { useDialog } from "@/hooks/use-dialog";

interface Props {
  onClose: () => void;
  editing?: Order;
  defaultDate?: string;
}

export function OrderForm({ onClose, editing, defaultDate }: Props) {
  const [orders, setOrders] = useOrders();
  const [clients, setClients] = useClients();
  const [rates] = useRates();
  const [shiftRates] = useShiftRates();
  const [settings] = useSettings();

  const [clientName, setClientName] = useState(editing?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(editing?.clientPhone ?? "");
  const [workType, setWorkType] = useState(editing?.workType ?? WORK_TYPES[0]);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({
    lat: editing?.lat,
    lng: editing?.lng,
  });
  const [showMap, setShowMap] = useState(editing?.lat != null);
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? toISODate(new Date()));
  const [hours, setHours] = useState(editing?.hours?.toString() ?? "");
  const [price, setPrice] = useState(editing?.price?.toString() ?? "");
  const [delivery, setDelivery] = useState(editing?.delivery?.toString() ?? "");

  const [priceTouched, setPriceTouched] = useState(Boolean(editing?.price));
  const [status, setStatus] = useState<OrderStatus>(editing?.status ?? "planned");
  const [paid, setPaid] = useState(editing?.paid ?? false);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [showDetails, setShowDetails] = useState(Boolean(editing));
  useDialog(true, onClose);

  const rate = rates[workType];
  const shiftRate = shiftRates[workType];
  const shiftHours = settings.shiftHours || 8;
  const busyDates = orders
    .filter((o) => o.status !== "cancelled" && o.id !== editing?.id)
    .map((o) => o.date);

  // подставляем цену транспортировки из настроек в новый заказ
  useEffect(() => {
    if (editing || delivery) return;
    if (settings.deliveryPrice) setDelivery(String(settings.deliveryPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.deliveryPrice]);

  function autoPrice(nextHours: string, nextType: string) {
    if (priceTouched) return;
    const r = rates[nextType];
    const s = shiftRates[nextType];
    const h = Number(nextHours);
    if (s && h >= shiftHours) {
      setPrice(String(Math.round(s)));
      return;
    }
    if (r && h > 0) setPrice(String(Math.round(h * r)));
    else if (s && !h) setPrice(String(Math.round(s)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;

    // upsert client
    let clientId = editing?.clientId;
    const cleanClientName = clientName.trim();
    const existing = clients.find(
      (client) => client.name.trim().toLowerCase() === cleanClientName.toLowerCase(),
    );
    const currentClient = editing?.clientId
      ? clients.find((client) => client.id === editing.clientId)
      : undefined;

    if (existing) {
      clientId = existing.id;
      if (clientPhone && existing.phone !== clientPhone) {
        setClients((prev) =>
          prev.map((client) =>
            client.id === existing.id ? { ...client, phone: clientPhone.trim() } : client,
          ),
        );
      }
    } else if (currentClient) {
      // Editing an order and changing its client name should rename the linked
      // client instead of leaving an orphaned duplicate in the client list.
      clientId = currentClient.id;
      setClients((prev) =>
        prev.map((client) =>
          client.id === currentClient.id
            ? {
                ...client,
                name: cleanClientName,
                phone: clientPhone.trim() || client.phone,
              }
            : client,
        ),
      );
    } else {
      clientId = uid();
      setClients((prev) => [
        ...prev,
        {
          id: clientId!,
          name: cleanClientName,
          phone: clientPhone.trim() || undefined,
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
      lat: coords.lat,
      lng: coords.lng,
      date,
      hours: hours ? Number(hours) : undefined,
      price: price ? Number(price) : 0,
      delivery: delivery ? Number(delivery) : undefined,
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
    >
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-card border-t sm:border border-border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-form-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
          <h2 id="order-form-title" className="font-display text-xl uppercase tracking-wide">
            {editing ? "Редактировать" : "Новый заказ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg hover:bg-accent"
            aria-label="Закрыть заказ"
          >
            <X className="mx-auto size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Field label="Клиент *">
            <input
              required
              value={clientName}
              onChange={(e) => {
                const nextName = e.target.value;
                setClientName(nextName);
                const savedClient = clients.find(
                  (client) => client.name.toLowerCase() === nextName.trim().toLowerCase(),
                );
                if (savedClient) setClientPhone(savedClient.phone ?? "");
              }}
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

          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
            className="w-full min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <ChevronDown
              className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
            />
            {showDetails ? "Скрыть дополнительные поля" : "Дополнительные поля"}
          </button>

          {showDetails && (
            <Field label="Телефон">
              <input
                type="tel"
                inputMode="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="input"
                placeholder="+7 ..."
              />
            </Field>
          )}

          <Field label="Вид работ">
            <select
              value={workType}
              onChange={(e) => {
                setWorkType(e.target.value);
                autoPrice(hours, e.target.value);
              }}
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

          {showDetails && (
            <>
              <button
                type="button"
                onClick={() => setShowMap((value) => !value)}
                className="w-full min-h-11 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <MapIcon className="size-4" />
                {showMap ? "Скрыть карту" : "Отметить на карте"}
              </button>

              {showMap && (
                <YandexMap
                  lat={coords.lat}
                  lng={coords.lng}
                  address={location}
                  onPick={(lat, lng, addr) => {
                    setCoords({ lat, lng });
                    if (addr) setLocation(addr);
                  }}
                />
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата">
              <DatePicker value={date} onChange={setDate} busy={busyDates} />
            </Field>
            <Field label="Часы">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  autoPrice(e.target.value, workType);
                }}
                className="input"
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Сумма за работу, ₽">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceTouched(true);
              }}
              className="input text-lg font-bold"
              placeholder="0"
            />
          </Field>
          {rate || shiftRate ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {rate ? `Ставка ${rate.toLocaleString("ru-RU")} ₽/ч. ` : ""}
              {shiftRate
                ? `Смена (${shiftHours} ч) — ${shiftRate.toLocaleString("ru-RU")} ₽. `
                : ""}
              Сумма считается автоматически.
              {priceTouched && (
                <button
                  type="button"
                  onClick={() => {
                    setPriceTouched(false);
                    const h = Number(hours);
                    if (shiftRate && h >= shiftHours) setPrice(String(shiftRate));
                    else if (rate && h > 0) setPrice(String(Math.round(h * rate)));
                    else if (shiftRate) setPrice(String(shiftRate));
                  }}
                  className="ml-1 text-primary font-semibold"
                >
                  Пересчитать
                </button>
              )}
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Итого
            </span>
            <span className="font-display text-xl text-primary">
              {formatMoney((Number(price) || 0) + (Number(delivery) || 0))}
            </span>
          </div>

          {showDetails && (
            <>
              <Field label="Доставка техники, ₽">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  className="input"
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
                      className={`min-h-11 rounded-lg text-sm font-medium border transition ${
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

              <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary cursor-pointer min-h-12">
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
            </>
          )}
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
            className="flex-[2] min-h-12 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
          >
            {editing ? "Сохранить" : "Добавить заказ"}
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
