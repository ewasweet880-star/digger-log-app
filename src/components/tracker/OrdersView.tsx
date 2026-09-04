import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Play,
  Plus,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useOrders,
  useExpenses,
  formatMoney,
  orderTotal,
  formatDate,
  isSameDay,
  parseISODate,
  type Order,
  type OrderStatus,
} from "@/lib/tracker-storage";
import { calculateDailyReport, type DailyReport } from "@/lib/tracker-calculations";
import { OrderForm } from "./OrderForm";
import {
  canNavigate,
  openNavigator,
  requestCurrentPosition,
  type StartPoint,
} from "@/lib/navigate";
import { RouteStartDialog } from "./RouteStartDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { OrderAttachmentList } from "./OrderAttachments";
import { attachmentIds, deleteAttachments } from "@/lib/attachments";
import { createCalendarEvent, downloadFile } from "@/lib/integrations";

const GEO_OK_KEY = "tracker.geoAllowed";

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
  const [expenses] = useExpenses();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | undefined>();
  const [filter, setFilter] = useState<Filter>("today");
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);

  const dailyReport = useMemo(() => calculateDailyReport(orders, expenses), [orders, expenses]);
  const currentOrderCount =
    dailyReport.scheduledCount +
    orders.filter((order) => order.status === "in_progress" && order.date !== dailyReport.date)
      .length;

  const grouped = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const filtered = orders
      .filter((order) => {
        const date = parseISODate(order.date);
        if (Number.isNaN(date.getTime())) return false;
        if (filter === "today") {
          return isSameDay(date, now) || order.status === "in_progress";
        }
        if (filter === "upcoming") {
          return date.getTime() > now.getTime() && order.status !== "cancelled";
        }
        if (filter === "done") return order.status === "done";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const map = new Map<string, Order[]>();
    for (const order of filtered) {
      map.set(order.date, [...(map.get(order.date) ?? []), order]);
    }
    return Array.from(map.entries());
  }, [orders, filter]);

  function updateOrder(id: string, patch: Partial<Order>) {
    const updatedAt = new Date().toISOString();
    setOrders((previous) =>
      previous.map((order) => (order.id === id ? { ...order, ...patch, updatedAt } : order)),
    );
  }

  function startOrder(id: string) {
    updateOrder(id, { status: "in_progress", startedAt: new Date().toISOString() });
  }

  function finishOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    const completedAt = new Date().toISOString();
    const elapsedHours = order?.startedAt
      ? (Date.parse(completedAt) - Date.parse(order.startedAt)) / 3_600_000
      : Number.NaN;
    const actualHours = Number.isFinite(elapsedHours) ? roundHours(elapsedHours) : undefined;
    updateOrder(id, {
      status: "done",
      completedAt,
      ...(actualHours !== undefined ? { actualHours } : {}),
    });
  }

  function markPaid(id: string) {
    updateOrder(id, { paid: true, paidAt: new Date().toISOString() });
  }

  function requestRemoveOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    if (order) setPendingDelete(order);
  }

  function confirmRemoveOrder() {
    if (!pendingDelete) return;
    setOrders((previous) => previous.filter((order) => order.id !== pendingDelete.id));
    void deleteAttachments(attachmentIds(pendingDelete.photoIds, pendingDelete.voiceNoteIds));
    setPendingDelete(null);
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {(
            [
              ["today", `Сегодня${currentOrderCount ? ` · ${currentOrderCount}` : ""}`],
              ["upcoming", "Ближайшие"],
              ["done", "Выполнено"],
              ["all", "Все"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filter === "today" && <DailyReportCard report={dailyReport} />}

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
                {items.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStart={() => startOrder(order.id)}
                    onFinish={() => finishOrder(order.id)}
                    onPaid={() => markPaid(order.id)}
                    onEdit={() => {
                      setEditing(order);
                      setFormOpen(true);
                    }}
                    onDelete={() => requestRemoveOrder(order.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
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

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить заказ?"
          description={`${pendingDelete.workType} · ${pendingDelete.clientName}. Заказ нельзя будет восстановить.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmRemoveOrder}
        />
      )}
    </div>
  );
}

function DailyReportCard({ report }: { report: DailyReport }) {
  const [message, setMessage] = useState<string | null>(null);
  const reportDate = parseISODate(report.date);

  async function share() {
    const text = dailyReportText(report);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Отчёт за ${report.date}`, text });
        setMessage("Отчёт отправлен.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage("Отчёт скопирован.");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    link.download = `smena-report-${report.date}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    setMessage("Отчёт скачан.");
  }

  return (
    <section className="p-3 pb-0" aria-labelledby="daily-report-title">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
            <BadgeCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="daily-report-title" className="font-display text-lg uppercase leading-tight">
              Отчёт за сегодня
            </h2>
            <p className="text-xs text-muted-foreground">
              {Number.isNaN(reportDate.getTime())
                ? report.date
                : reportDate.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">обновляется сам</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <ReportMetric label="Запланировано" value={String(report.plannedCount)} />
          <ReportMetric label="Выполняется" value={String(report.inProgressCount)} />
          <ReportMetric label="Завершено" value={String(report.completedCount)} positive />
          <ReportMetric label="Заработано" value={formatMoney(report.earned)} />
          <ReportMetric label="Получено" value={formatMoney(report.received)} positive />
          <ReportMetric label="К получению" value={formatMoney(report.toReceive)} />
          <ReportMetric label="Часы работы" value={`${formatHours(report.hours)} ч`} />
          <ReportMetric label="Расходы" value={formatMoney(report.expenses)} negative />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Итого за день
            </div>
            <div
              className={`font-display text-2xl ${report.net >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}
            >
              {formatMoney(report.net)}
            </div>
          </div>
          <button
            type="button"
            onClick={share}
            className="min-h-11 px-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold"
          >
            Поделиться отчётом
          </button>
        </div>
        {message && <p className="text-xs text-[color:var(--success)]">{message}</p>}
      </div>
    </section>
  );
}

function ReportMetric({
  label,
  value,
  positive = false,
  negative = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-semibold mt-0.5 ${
          positive ? "text-[color:var(--success)]" : negative ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onStart,
  onFinish,
  onPaid,
  onEdit,
  onDelete,
}: {
  order: Order;
  onStart: () => void;
  onFinish: () => void;
  onPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[order.status];
  const Icon = meta.icon;
  const [askGeo, setAskGeo] = useState(false);
  const shownHours = order.actualHours ?? order.hours;

  async function route() {
    const remembered =
      typeof localStorage !== "undefined" && localStorage.getItem(GEO_OK_KEY) === "1";
    if (!remembered) {
      setAskGeo(true);
      return;
    }
    const from = await requestCurrentPosition();
    openNavigator(order, from);
  }

  function finish(from: StartPoint | null) {
    setAskGeo(false);
    if (from) localStorage.setItem(GEO_OK_KEY, "1");
    openNavigator(order, from);
  }

  function addToCalendar() {
    downloadFile(
      createCalendarEvent(order),
      `smena-${order.date}-${order.id}.ics`,
      "text/calendar;charset=utf-8",
    );
  }

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
          <div className="font-display text-lg leading-tight truncate">{order.workType}</div>
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

      {(order.location || order.clientPhone || shownHours != null || order.startedAt) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {order.location && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{order.location}</span>
            </span>
          )}
          {shownHours != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {order.actualHours != null ? "Факт " : "План "}
              {formatHours(shownHours)} ч
            </span>
          ) : null}
          {order.startedAt && order.status === "in_progress" && (
            <span>Начато в {formatTime(order.startedAt)}</span>
          )}
          {order.completedAt && order.status === "done" && (
            <span>Завершено в {formatTime(order.completedAt)}</span>
          )}
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
        <p className="text-sm text-muted-foreground border-l-2 border-border pl-2">{order.notes}</p>
      )}

      <OrderAttachmentList photoIds={order.photoIds} voiceNoteIds={order.voiceNoteIds} />

      {order.status === "planned" && (
        <button
          type="button"
          onClick={onStart}
          className="w-full min-h-12 rounded-xl bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <Play className="size-4" fill="currentColor" /> Начать работу
        </button>
      )}
      {order.status === "in_progress" && (
        <button
          type="button"
          onClick={onFinish}
          className="w-full min-h-12 rounded-xl bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <Square className="size-4" fill="currentColor" /> Завершить
        </button>
      )}
      {order.status === "done" && !order.paid && (
        <button
          type="button"
          onClick={onPaid}
          className="w-full min-h-12 rounded-xl bg-[color:var(--success)] text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <BadgeCheck className="size-4" /> Оплачено
        </button>
      )}

      {order.status !== "cancelled" && (
        <button
          type="button"
          onClick={addToCalendar}
          className="w-full min-h-10 rounded-xl border border-border text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <CalendarPlus className="size-4" /> Добавить в календарь
        </button>
      )}

      <div className="flex gap-2 pt-1">
        {canNavigate(order) && (
          <button
            type="button"
            onClick={route}
            className="flex-1 min-h-11 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-bold inline-flex items-center justify-center gap-1"
          >
            <Navigation className="size-4" /> Маршрут
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 min-h-11 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium inline-flex items-center justify-center gap-1"
        >
          <Pencil className="size-4" /> Изменить
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-11 min-w-11 rounded-lg bg-secondary text-destructive text-sm"
          aria-label="Удалить"
        >
          <Trash2 className="mx-auto size-4" />
        </button>
      </div>

      {askGeo && <RouteStartDialog onCancel={() => setAskGeo(false)} onReady={finish} />}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-20 text-center">
      <div className="mx-auto size-24 rounded-full stripe-tape opacity-40 mb-6" />
      <h3 className="font-display text-2xl uppercase mb-2">Пусто</h3>
      <p className="text-muted-foreground mb-6">Здесь появятся заказы. Добавьте первый.</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-12 items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
      >
        <Plus className="size-5" /> Новый заказ
      </button>
    </div>
  );
}

function dailyReportText(report: DailyReport) {
  return [
    `Отчёт «Смена» за ${report.date}`,
    `Запланировано: ${report.plannedCount}`,
    `Выполняется: ${report.inProgressCount}`,
    `Завершено: ${report.completedCount}`,
    `Заработано: ${formatMoney(report.earned)}`,
    `Получено: ${formatMoney(report.received)}`,
    `К получению: ${formatMoney(report.toReceive)}`,
    `Часов: ${formatHours(report.hours)}`,
    `Расходы: ${formatMoney(report.expenses)}`,
    `Итого за день: ${formatMoney(report.net)}`,
  ].join("\n");
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function roundHours(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}
