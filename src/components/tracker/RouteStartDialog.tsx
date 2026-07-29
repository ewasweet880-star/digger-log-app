import { useState } from "react";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import {
  requestCurrentPosition,
  geolocationSupported,
  type StartPoint,
} from "@/lib/navigate";

interface Props {
  onCancel: () => void;
  onReady: (from: StartPoint | null) => void;
}

/** Подтверждение доступа к геопозиции перед построением маршрута. */
export function RouteStartDialog({ onCancel, onReady }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function allow() {
    setLoading(true);
    setError(null);
    const pos = await requestCurrentPosition();
    setLoading(false);
    if (!pos) {
      setError("Не удалось получить местоположение. Проверьте доступ к геолокации в настройках телефона.");
      return;
    }
    onReady(pos);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <MapPin className="size-5 text-primary" />
          </div>
          <h2 className="font-display text-lg uppercase tracking-wide leading-tight">
            Точка старта маршрута
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Разрешить приложению определить текущее местоположение, чтобы построить
          маршрут от вас до места работы? Координаты используются только для
          открытия Яндекс.Навигатора.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <button
            onClick={allow}
            disabled={loading || !geolocationSupported()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Navigation className="size-4" />
            )}
            Разрешить и построить
          </button>
          <button
            onClick={() => onReady(null)}
            className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold"
          >
            Без геолокации
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-sm text-muted-foreground"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
