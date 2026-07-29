import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  MONTHS_RU,
  WEEKDAYS_RU,
  monthGrid,
  toISODate,
  isSameDay,
} from "@/lib/tracker-storage";

interface Props {
  value: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  /** Даты, на которые уже есть заказы — подсвечиваются точкой */
  busy?: string[];
}

export function DatePicker({ value, onChange, busy = [] }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Date(`${value}T00:00:00`), [value]);
  const [view, setView] = useState(() => new Date(selected));

  useEffect(() => {
    if (open) setView(new Date(selected));
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const busySet = useMemo(() => new Set(busy), [busy]);
  const days = monthGrid(view.getFullYear(), view.getMonth());
  const today = new Date();

  function shift(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span>
          {selected.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
        <CalendarDays className="size-5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover p-3 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="font-display uppercase tracking-wide">
              {MONTHS_RU[view.getMonth()]} {view.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS_RU.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-bold uppercase text-muted-foreground py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const iso = toISODate(d);
              const other = d.getMonth() !== view.getMonth();
              const isSel = isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`relative aspect-square rounded-lg text-sm font-medium transition ${
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : other
                        ? "text-muted-foreground/40 hover:bg-accent"
                        : "hover:bg-accent"
                  } ${isToday && !isSel ? "ring-1 ring-primary" : ""}`}
                >
                  {d.getDate()}
                  {busySet.has(iso) && !isSel && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(toISODate(new Date()));
              setOpen(false);
            }}
            className="w-full mt-2 py-2 rounded-lg bg-secondary text-sm font-semibold"
          >
            Сегодня
          </button>
        </div>
      )}
    </div>
  );
}
