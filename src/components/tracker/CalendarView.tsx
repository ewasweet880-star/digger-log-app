import { useMemo, useState } from "react";
import {
  useOrders,
  formatMoney,
  orderTotal,
  MONTHS_RU,
  WEEKDAYS_RU,
  monthGrid,
  toISODate,
  isSameDay,
  type Order,
} from "@/lib/tracker-storage";
import { OrderForm } from "./OrderForm";
import { ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";

export function CalendarView() {
  const [orders] = useOrders();
  const [view, setView] = useState(() => new Date());
  const [selected, setSelected] = useState(() => toISODate(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | undefined>();

  const byDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      map.set(o.date, [...(map.get(o.date) ?? []), o]);
    }
    return map;
  }, [orders]);

  const days = monthGrid(view.getFullYear(), view.getMonth());
  const today = new Date();
  const dayOrders = byDate.get(selected) ?? [];

  const monthTotal = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.status !== "cancelled" &&
            new Date(`${o.date}T00:00:00`).getMonth() === view.getMonth() &&
            new Date(`${o.date}T00:00:00`).getFullYear() === view.getFullYear(),
        )
        .reduce((s, o) => s + orderTotal(o), 0),
    [orders, view],
  );

  function shift(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="pb-28">
      <div className="p-3">
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => shift(-1)}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="text-center">
              <div className="font-display text-lg uppercase leading-none">
                {MONTHS_RU[view.getMonth()]} {view.getFullYear()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatMoney(monthTotal)} за месяц
              </div>
            </div>
            <button
              onClick={() => shift(1)}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-7">
            {WEEKDAYS_RU.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-bold uppercase text-muted-foreground py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const iso = toISODate(d);
              const items = byDate.get(iso) ?? [];
              const other = d.getMonth() !== view.getMonth();
              const isSel = iso === selected;
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-semibold transition ${
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : other
                        ? "text-muted-foreground/40"
                        : "bg-secondary/50"
                  } ${isToday && !isSel ? "ring-1 ring-primary" : ""}`}
                >
                  {d.getDate()}
                  {items.length > 0 && (
                    <span
                      className={`mt-0.5 text-[9px] font-bold ${
                        isSel ? "text-primary-foreground" : "text-primary"
                      }`}
                    >
                      {items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-3 space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold px-1">
          {new Date(`${selected}T00:00:00`).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "long",
            weekday: "long",
          })}
        </h3>

        {dayOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-4">
            На этот день заказов нет.
          </p>
        ) : (
          dayOrders.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setEditing(o);
                setFormOpen(true);
              }}
              className="w-full text-left bg-card border border-border rounded-xl p-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center"
            >
              <div className="min-w-0">
                <div className="font-display truncate">{o.workType}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {o.clientName}
                  {o.location ? (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <MapPin className="size-3" />
                      {o.location}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="font-display text-primary shrink-0">
                {formatMoney(orderTotal(o))}
              </div>
            </button>
          ))
        )}
      </div>

      <button
        onClick={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
        className="fixed bottom-24 right-4 z-30 size-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition"
        aria-label="Новый заказ"
      >
        <Plus className="size-8" strokeWidth={2.5} />
      </button>

      {formOpen && (
        <OrderForm
          editing={editing}
          defaultDate={selected}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}
