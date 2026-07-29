import { useMemo } from "react";
import { useOrders, useExpenses, formatMoney, orderTotal } from "@/lib/tracker-storage";
import { TrendingUp, Wallet, Clock, CheckCircle2, Fuel, Wrench } from "lucide-react";

export function EarningsView() {
  const [orders] = useOrders();

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startWeek.setHours(0, 0, 0, 0);

    let month = 0,
      week = 0,
      total = 0,
      unpaid = 0,
      planned = 0,
      hoursMonth = 0,
      doneCount = 0;

    for (const o of orders) {
      const d = new Date(o.date);
      if (o.status !== "cancelled") {
        total += orderTotal(o);
        if (d >= startMonth) {
          month += orderTotal(o);
          hoursMonth += o.hours || 0;
        }
        if (d >= startWeek) week += orderTotal(o);
        if (o.status === "done") doneCount++;
      }
      if (!o.paid && o.status !== "cancelled") unpaid += orderTotal(o);
      if (o.status === "planned") planned += orderTotal(o);
    }
    return { month, week, total, unpaid, planned, hoursMonth, doneCount };
  }, [orders]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const d = new Date(o.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + (orderTotal(o)));
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [orders]);

  const max = Math.max(1, ...byMonth.map(([, v]) => v));

  return (
    <div className="p-4 pb-28 space-y-4">
      <div className="bg-primary text-primary-foreground rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-3 stripe-tape opacity-90" />
        <div className="text-xs font-bold uppercase tracking-widest opacity-80">
          Заработано в этом месяце
        </div>
        <div className="font-display text-5xl mt-2">{formatMoney(stats.month)}</div>
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <div className="opacity-70 text-xs uppercase">Неделя</div>
            <div className="font-bold text-lg">{formatMoney(stats.week)}</div>
          </div>
          <div>
            <div className="opacity-70 text-xs uppercase">Часов</div>
            <div className="font-bold text-lg">{stats.hoursMonth} ч</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Wallet}
          label="К получению"
          value={formatMoney(stats.unpaid)}
          accent="text-destructive"
        />
        <StatCard
          icon={Clock}
          label="В плане"
          value={formatMoney(stats.planned)}
          accent="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Всего"
          value={formatMoney(stats.total)}
        />
        <StatCard
          icon={CheckCircle2}
          label="Выполнено"
          value={`${stats.doneCount}`}
          accent="text-[color:var(--success)]"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-display uppercase tracking-wide text-sm mb-4 text-muted-foreground">
          По месяцам
        </h3>
        {byMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет данных.</p>
        ) : (
          <div className="space-y-3">
            {byMonth.map(([k, v]) => {
              const [y, m] = k.split("-");
              const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
                "ru-RU",
                { month: "long", year: "2-digit" },
              );
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-muted-foreground">{name}</span>
                    <span className="font-bold">{formatMoney(v)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(v / max) * 100}%` }}
                    />
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
