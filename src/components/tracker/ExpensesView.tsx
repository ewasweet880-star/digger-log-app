import { useMemo, useState } from "react";
import { Fuel, Plus, Trash2, Wrench, X } from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
  expenseLabel,
  formatMoney,
  toISODate,
  uid,
  useExpenses,
} from "@/lib/tracker-storage";
import { DatePicker } from "@/components/tracker/DatePicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDialog } from "@/hooks/use-dialog";
import { getMonthRange, isDateInRange } from "@/lib/date-utils";

export function ExpensesView() {
  const [expenses, setExpenses] = useExpenses();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
    [expenses],
  );

  const stats = useMemo(() => {
    const { start, endExclusive } = getMonthRange(new Date());
    let month = 0,
      fuelMonth = 0,
      serviceMonth = 0,
      litersMonth = 0,
      total = 0;
    for (const e of expenses) {
      total += e.amount || 0;
      if (isDateInRange(e.date, start, endExclusive)) {
        month += e.amount || 0;
        if (e.category === "fuel") {
          fuelMonth += e.amount || 0;
          litersMonth += e.liters || 0;
        }
        if (e.category === "service" || e.category === "parts") serviceMonth += e.amount || 0;
      }
    }
    return { month, fuelMonth, serviceMonth, litersMonth, total };
  }, [expenses]);

  function save(e: Expense) {
    setExpenses((prev) => {
      const exists = prev.some((x) => x.id === e.id);
      return exists ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev];
    });
    setFormOpen(false);
    setEditing(null);
  }

  function remove(expense: Expense) {
    setPendingDelete(expense);
  }

  function confirmRemove() {
    if (!pendingDelete) return;
    setExpenses((prev) => prev.filter((expense) => expense.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  return (
    <div className="p-4 pb-28 space-y-4">
      <div className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-3 stripe-tape opacity-70" />
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Расходы в этом месяце
        </div>
        <div className="font-display text-4xl mt-1 text-destructive">
          {formatMoney(stats.month)}
        </div>
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase flex items-center gap-1">
              <Fuel className="size-3.5" /> Топливо
            </div>
            <div className="font-bold">{formatMoney(stats.fuelMonth)}</div>
            {stats.litersMonth > 0 && (
              <div className="text-xs text-muted-foreground">{stats.litersMonth} л</div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase flex items-center gap-1">
              <Wrench className="size-3.5" /> ТО и запчасти
            </div>
            <div className="font-bold">{formatMoney(stats.serviceMonth)}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="w-full min-h-12 bg-primary text-primary-foreground rounded-2xl py-3 font-display uppercase tracking-wide flex items-center justify-center gap-2"
      >
        <Plus className="size-5" /> Добавить расход
      </button>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Пока нет расходов. Записывайте заправки и обслуживание техники.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((e) => (
            <div
              key={e.id}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="size-10 rounded-xl bg-secondary grid place-items-center shrink-0">
                {e.category === "fuel" ? (
                  <Fuel className="size-5" />
                ) : (
                  <Wrench className="size-5" />
                )}
              </div>
              <button
                onClick={() => {
                  setEditing(e);
                  setFormOpen(true);
                }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="font-semibold truncate">
                  {expenseLabel(e.category)}
                  {e.liters ? ` · ${e.liters} л` : ""}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(`${e.date}T00:00:00`).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                  })}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </button>
              <div className="font-display text-lg text-destructive shrink-0">
                −{formatMoney(e.amount)}
              </div>
              <button
                type="button"
                onClick={() => remove(e)}
                aria-label="Удалить расход"
                className="min-h-11 min-w-11 text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="text-right text-sm text-muted-foreground pt-2">
            Всего расходов: <b className="text-foreground">{formatMoney(stats.total)}</b>
          </div>
        </div>
      )}

      {formOpen && (
        <ExpenseForm
          initial={editing}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить расход?"
          description={`${expenseLabel(pendingDelete.category)} · ${formatMoney(pendingDelete.amount)}. Запись нельзя будет восстановить.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}

function ExpenseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Expense | null;
  onSave: (e: Expense) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "fuel");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [liters, setLiters] = useState(initial?.liters ? String(initial.liters) : "");
  const [date, setDate] = useState(initial?.date ?? toISODate(new Date()));
  const [note, setNote] = useState(initial?.note ?? "");
  useDialog(true, onCancel);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    onSave({
      id: initial?.id ?? uid(),
      category,
      amount: Number(amount) || 0,
      liters: category === "fuel" && liters ? Number(liters) : undefined,
      date,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur overflow-y-auto"
      role="presentation"
    >
      <form
        onSubmit={submit}
        className="max-w-2xl mx-auto p-4 pb-28 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-form-title"
      >
        <div className="flex items-center gap-3 pt-2">
          <h2 id="expense-form-title" className="font-display text-2xl uppercase flex-1">
            {initial ? "Расход" : "Новый расход"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
            className="min-h-11 min-w-11 rounded-xl bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-xl py-3 text-sm font-semibold border transition ${
                category === c.value
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Сумма, ₽
          </span>
          <input
            className="input mt-1"
            type="number"
            inputMode="decimal"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        {category === "fuel" && (
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Литры (необязательно)
            </span>
            <input
              className="input mt-1"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
            />
          </label>
        )}

        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Дата
          </span>
          <div className="mt-1">
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Комментарий
          </span>
          <input
            className="input mt-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="АЗС, замена масла, фильтры…"
          />
        </label>

        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-display uppercase tracking-wide"
        >
          Сохранить
        </button>
      </form>
    </div>
  );
}
