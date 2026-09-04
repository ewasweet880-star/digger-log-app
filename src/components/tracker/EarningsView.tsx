import { useMemo } from "react";
import {
  useOrders,
  useExpenses,
  formatMoney,
  orderTotal,
  parseISODate,
  expenseLabel,
} from "@/lib/tracker-storage";
import { calculateEarnings } from "@/lib/tracker-calculations";
import {
  CheckCircle2,
  FileSpreadsheet,
  Fuel,
  Printer,
  TrendingUp,
  Wallet,
  Wrench,
  Clock,
} from "lucide-react";
import { downloadFile } from "@/lib/integrations";

export function EarningsView() {
  const [orders] = useOrders();
  const [expenses] = useExpenses();
  const stats = useMemo(() => calculateEarnings(orders, expenses), [orders, expenses]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { amount: number; hours: number }>();
    for (const order of orders) {
      if (order.status !== "done") continue;
      const date = parseISODate(order.date);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const previous = map.get(key) ?? { amount: 0, hours: 0 };
      map.set(key, {
        amount: previous.amount + orderTotal(order),
        hours: previous.hours + (order.actualHours ?? order.hours ?? 0),
      });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6);
  }, [orders]);

  const max = Math.max(1, ...byMonth.map(([, value]) => value.amount));

  function exportExcel() {
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const orderRows = orders
      .filter((order) => order.status !== "cancelled" && order.date.startsWith(monthKey))
      .map((order) => [
        order.date,
        order.clientName,
        order.workType,
        order.status,
        order.hours ?? "",
        order.actualHours ?? "",
        order.price,
        order.delivery ?? 0,
        orderTotal(order),
        order.paid ? "Да" : "Нет",
        order.completedAt ?? "",
        order.paidAt ?? "",
      ]);
    const expenseRows = expenses
      .filter((expense) => expense.date.startsWith(monthKey))
      .map((expense) => [
        expense.date,
        expenseLabel(expense.category),
        expense.note ?? "",
        expense.amount,
      ]);
    const rows = [
      [
        "Дата",
        "Клиент",
        "Работа",
        "Статус",
        "План, ч",
        "Факт, ч",
        "Работа, ₽",
        "Доставка, ₽",
        "Итого, ₽",
        "Оплачено",
        "Завершён",
        "Оплачен",
      ],
      ...orderRows,
      [],
      ["РАСХОДЫ ЗА МЕСЯЦ"],
      ["Дата", "Категория", "Комментарий", "Сумма, ₽"],
      ...expenseRows,
    ];
    downloadFile(
      `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`,
      `smena-report-${monthKey}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  return (
    <div className="p-4 pb-28 space-y-4 print-report">
      <div className="bg-primary text-primary-foreground rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-3 stripe-tape opacity-90" />
        <div className="text-xs font-bold uppercase tracking-widest opacity-80">
          Заработано за выполненные заказы
        </div>
        <div className="font-display text-5xl mt-2">{formatMoney(stats.earnedMonth)}</div>
        <div className="mt-2 text-sm opacity-75">
          Запланировано на месяц: {formatMoney(stats.scheduledMonth)}
        </div>
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <div className="opacity-70 text-xs uppercase">Эта неделя</div>
            <div className="font-bold text-lg">{formatMoney(stats.earnedWeek)}</div>
          </div>
          <div>
            <div className="opacity-70 text-xs uppercase">Часов в работе</div>
            <div className="font-bold text-lg">{stats.hoursMonth} ч</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 print-actions">
        <button
          type="button"
          onClick={exportExcel}
          className="min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <FileSpreadsheet className="size-4" /> Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <Printer className="size-4" /> Печать / PDF
        </button>
      </div>

      <div className="bg-card border border-border rounded-3xl p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Чистая прибыль за месяц
        </div>
        <div
          className={`font-display text-4xl mt-1 ${
            stats.earnedMonth - stats.expensesMonth >= 0
              ? "text-[color:var(--success)]"
              : "text-destructive"
          }`}
        >
          {formatMoney(stats.earnedMonth - stats.expensesMonth)}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Выполнено {formatMoney(stats.earnedMonth)} − расходы {formatMoney(stats.expensesMonth)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Fuel}
          label="Топливо, месяц"
          value={formatMoney(stats.fuelMonth)}
          accent="text-destructive"
        />
        <StatCard
          icon={Wrench}
          label="ТО и запчасти"
          value={formatMoney(stats.serviceMonth)}
          accent="text-destructive"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Получено, месяц"
          value={formatMoney(stats.receivedMonth)}
          accent="text-[color:var(--success)]"
        />
        <StatCard
          icon={Wallet}
          label="К получению, выполнено"
          value={formatMoney(stats.toReceive)}
          accent="text-destructive"
        />
        <StatCard
          icon={Clock}
          label="В плане"
          value={formatMoney(stats.planned)}
          accent="text-primary"
        />
        <StatCard icon={TrendingUp} label="Все заказы" value={formatMoney(stats.total)} />
        <StatCard
          icon={CheckCircle2}
          label="Выполнено"
          value={`${stats.doneCount}`}
          accent="text-[color:var(--success)]"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-display uppercase tracking-wide text-sm mb-4 text-muted-foreground">
          Выполненные заказы по месяцам
        </h3>
        {byMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет данных.</p>
        ) : (
          <div className="space-y-3">
            {byMonth.map(([key, value]) => {
              const [year, month] = key.split("-");
              const name = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
                "ru-RU",
                {
                  month: "long",
                  year: "2-digit",
                },
              );
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-muted-foreground">{name}</span>
                    <span className="font-bold">{formatMoney(value.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(value.amount / max) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Фактически отработано: {formatHours(value.hours)} ч
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "text-foreground",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <Icon className={`size-5 mb-2 ${accent}`} />
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`font-display text-xl mt-1 truncate ${accent}`}>{value}</div>
    </div>
  );
}
