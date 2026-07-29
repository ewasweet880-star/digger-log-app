import { useRates, useSettings, WORK_TYPES } from "@/lib/tracker-storage";
import { ExternalLink, KeyRound, X } from "lucide-react";

export function SettingsView({ onClose }: { onClose: () => void }) {
  const [rates, setRates] = useRates();
  const [settings, setSettings] = useSettings();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-card border-t sm:border border-border shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
          <h2 className="font-display text-xl uppercase tracking-wide">Настройки</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Ставки, ₽ за час
            </h3>
            <p className="text-sm text-muted-foreground">
              Укажите цену за час — сумма заказа посчитается сама по часам.
            </p>
            <div className="space-y-2 pt-1">
              {WORK_TYPES.map((w) => (
                <div key={w} className="flex items-center gap-3">
                  <span className="flex-1 text-sm truncate">{w}</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={rates[w] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRates((prev) => {
                        const next = { ...prev };
                        if (!v) delete next[w];
                        else next[w] = Number(v);
                        return next;
                      });
                    }}
                    className="input w-32 text-right"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Яндекс.Карты
            </h3>
            <p className="text-sm text-muted-foreground">
              Вставьте бесплатный ключ JavaScript API — тогда в заказе появится карта с
              выбором точки и адресом.
            </p>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground shrink-0" />
              <input
                value={settings.yandexApiKey ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, yandexApiKey: e.target.value }))
                }
                className="input"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <a
              href="https://developer.tech.yandex.ru/services"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary font-semibold"
            >
              Получить ключ <ExternalLink className="size-3.5" />
            </a>
          </section>
        </div>

        <div className="sticky bottom-0 p-4 bg-card border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
