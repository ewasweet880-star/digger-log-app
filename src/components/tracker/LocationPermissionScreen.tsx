import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, MapPin, Navigation, ShieldCheck } from "lucide-react";
import {
  GEO_ERROR_TEXT,
  checkLocationPermission,
  geolocationSupported,
  getCurrentPosition,
} from "@/lib/geo";
import { useDialog } from "@/hooks/use-dialog";

import { readGeoConsent, saveGeoConsent, type GeoConsent } from "@/lib/geo-consent";

interface Props {
  /** Вызывается после решения пользователя (разрешил или отказался). */
  onDone: (consent: GeoConsent) => void;
}

/**
 * Экран запроса разрешения на геолокацию.
 * Показывается при первом запуске и вручную из настроек.
 * Отказ («Отмена») запоминается: экран больше не мешает работе.
 */
export function LocationPermissionScreen({ onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  useDialog(true, cancel);

  useEffect(() => {
    void checkLocationPermission().then((state) => {
      if (state === "granted") {
        saveGeoConsent("granted");
        onDone("granted");
      }
    });
    // намеренно один раз при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function allow() {
    setBusy(true);
    setError(null);
    const { point, error: geoErr } = await getCurrentPosition();
    setBusy(false);
    if (point) {
      saveGeoConsent("granted");
      onDone("granted");
      return;
    }
    setDenied(geoErr === "denied");
    setError(GEO_ERROR_TEXT[geoErr ?? "unavailable"]);
  }

  function cancel() {
    saveGeoConsent("declined");
    onDone("declined");
  }

  const unsupported = !geolocationSupported();

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground overflow-y-auto"
      role="presentation"
    >
      <div
        className="max-w-md mx-auto min-h-full flex flex-col justify-center px-5 py-10 space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-permission-title"
      >
        <div className="size-16 rounded-2xl bg-primary/15 flex items-center justify-center">
          <MapPin className="size-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1
            id="geo-permission-title"
            className="font-display text-2xl uppercase tracking-wide leading-tight"
          >
            Доступ к геолокации
          </h1>
          <p className="text-sm text-muted-foreground">
            Приложению нужно текущее местоположение, чтобы:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 pl-1">
            <li className="flex gap-2">
              <Navigation className="size-4 mt-0.5 text-primary shrink-0" />
              строить маршрут к месту работы от вашей точки;
            </li>
            <li className="flex gap-2">
              <MapPin className="size-4 mt-0.5 text-primary shrink-0" />
              ставить метку заказа кнопкой «Я здесь» на карте.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-4 mt-0.5 text-primary shrink-0" />
              координаты сохраняются в приложении и используются для работы с Яндекс.Картами.
            </li>
          </ul>
        </div>

        {unsupported && (
          <p className="text-sm text-muted-foreground">
            Устройство не поддерживает определение местоположения — можно продолжить без него.
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex gap-2">
            <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-destructive">{error}</p>
              {denied && (
                <p className="text-xs text-muted-foreground">
                  Можно продолжить без геолокации — маршрут построится «от текущего места» силами
                  Яндекс.Навигатора.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={allow}
            disabled={busy || unsupported}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            {busy ? "Определяю..." : "Разрешить доступ"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-60"
          >
            Отмена — продолжить без геолокации
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Разрешение можно выдать позже в разделе «Настройки → Геолокация».
          </p>
        </div>
      </div>
    </div>
  );
}
