import { useMemo, useState } from "react";
import {
  useOrders,
  formatMoney,
  orderTotal,

  formatDate,
  isSameDay,
  type Order,
  type OrderStatus,
} from "@/lib/tracker-storage";
import { OrderForm } from "./OrderForm";
import {
  Plus,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  CircleDashed,
  Loader2,
  XCircle,
  Trash2,
  Pencil,
  Navigation,
} from "lucide-react";
import { canNavigate, openNavigator } from "@/lib/navigate";

const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  planned: { label: "План", icon: CircleDashed, className: "text-muted-foreground" },
  in_progress: { label: "В работе", icon: Loader2, className: "text-primary" },
  done: { label: "Выполнен", icon: CheckCircle2, className: "text-[color:var(--success)]" },
  cancelled: { label: "Отменён", icon: XCircle, className: "text-destructive" },
};

type Filter = "today" | "upcoming" | "done" | "all";

export function OrdersView() {
  const [orders, setOrders] = useOrders();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | undefined>();
  const [filter, setFilter] = useState<Filter>("today");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grouped = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const filtered = orders
      .filter((o) => {
        const d = new Date(o.date);
        d.setHours(0, 0, 0, 0);
        if (filter === "today") return isSameDay(d, now);
        if (filter === "upcoming") return d.getTime() > now.getTime() && o.status !== "cancelled";
        if (filter === "done") return o.status === "done";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const map = new Map<string, Order[]>();
    for (const o of filtered) {
      const key = o.date;
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return Array.from(map.entries());
  }, [orders, filter]);

  const todayCount = orders.filter((o) => {
    const d = new Date(o.date);
    d.setHours(0, 0, 0, 0);
    return isSameDay(d, today);
  }).length;

  function removeOrder(id: string) {
    if (!confirm("Удалить заказ?")) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {(
            [
              ["today", `Сегодня${todayCount ? ` · ${todayCount}` : ""}`],
              ["upcoming", "Ближайшие"],
              ["done", "Выполнено"],
              ["all", "Все"],
            ] as [Filter, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                filter === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState onAdd={() => setFormOpen(true)} />
      ) : (
        <div className="p-3 space-y-6">
          {grouped.map(([date, items]) => (
            <section key={date}>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {items.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onEdit={() => {
                      setEditing(o);
                      setFormOpen(true);
                    }}
                    onDelete={() => removeOrder(o.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

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
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  onEdit,
  onDelete,
}: {
  order: Order;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[order.status];
  const Icon = meta.icon;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`size-4 shrink-0 ${meta.className}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${meta.className}`}>
              {meta.label}
            </span>
          </div>
          <div className="font-display text-lg leading-tight truncate">
            {order.workType}
          </div>
          <div className="text-sm text-muted-foreground truncate">{order.clientName}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-xl text-primary leading-none">
            {formatMoney(orderTotal(order))}
          </div>
          {order.paid ? (
            <span className="text-[10px] font-bold uppercase text-[color:var(--success)] mt-1 inline-block">
              Оплачено
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase text-muted-foreground mt-1 inline-block">
              К оплате
            </span>
          )}
        </div>
      </div>

      {(order.location || order.clientPhone || order.hours) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {order.location && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{order.location}</span>
            </span>
          )}
          {order.hours ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {order.hours} ч
            </span>
          ) : null}
          {order.clientPhone && (
            <a
              href={`tel:${order.clientPhone}`}
              className="inline-flex items-center gap-1 text-primary"
            >
              <Phone className="size-3.5" />
              {order.clientPhone}
            </a>
          )}
        </div>
      )}

      {order.notes && (
        <p className="text-sm text-muted-foreground border-l-2 border-border pl-2">
          {order.notes}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {canNavigate(order) && (
          <button
            onClick={() => openNavigator(order)}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-1"
          >
            <Navigation className="size-4" /> Маршрут
          </button>
        )}
        <button
          onClick={onEdit}
          className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium inline-flex items-center justify-center gap-1"
        >
          <Pencil className="size-4" /> Изменить
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 rounded-lg bg-secondary text-destructive text-sm"
          aria-label="Удалить"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-20 text-center">
      <div className="mx-auto size-24 rounded-full stripe-tape opacity-40 mb-6" />
      <h3 className="font-display text-2xl uppercase mb-2">Пусто</h3>
      <p className="text-muted-foreground mb-6">
        Здесь появятся заказы. Добавьте первый.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
      >
        <Plus className="size-5" /> Новый заказ
      </button>
    </div>
  );
}
