import { useEffect, useState } from "react";
import {
  DEFAULT_GEOCODER_KEY,
  DEFAULT_YANDEX_KEY,
  useRates,
  useSettings,
  useShiftRates,
  WORK_TYPES,
} from "@/lib/tracker-storage";
import {
  checkLocationPermission,
  geolocationSupported,
  getCurrentPosition,
  isNativeApp,
  nativeGeolocationAvailable,
  type PermissionState,
} from "@/lib/geo";
import {
  ExternalLink,
  KeyRound,
  Loader2,
  LocateFixed,
  MapPin,
  X,
} from "lucide-react";

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: "Доступ разрешён",
  denied: "Доступ запрещён",
  prompt: "Разрешение ещё не запрошено",
  unknown: "Состояние неизвестно",
};

function GeolocationSection() {
  const [state, setState] = useState<PermissionState>("unknown");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [nativePlugin, setNativePlugin] = useState<boolean | null>(null);

  useEffect(() => {
    void checkLocationPermission().then(setState);
    void nativeGeolocationAvailable().then(setNativePlugin);
  }, []);

  const brokenBuild = isNativeApp() && nativePlugin === false;

  async function request() {
    setBusy(true);
    setNote(null);
    try {
      const { point, error } = await getCurrentPosition();
      setState(await checkLocationPermission());
      if (point) {
        setNote(
          `Местоположение получено: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        );
      } else if (error === "denied") {
        setNote(
          "Android отказал в доступе. Откройте «Настройки → Приложения → Смена → Разрешения → Геоданные» и включите доступ. Если такого пункта нет — APK собран без разрешения, нужна пересборка (см. ниже).",
        );
      } else if (error === "timeout") {
        setNote(
          "GPS не ответил за 20 секунд. Включите геолокацию телефона, выйдите на открытое место и повторите.",
        );
      } else {
        setNote("Не удалось получить координаты. Включите GPS и попробуйте ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Геолокация
      </h3>
      <p className="text-sm text-muted-foreground">
        Нужна для кнопки «Я здесь» на карте и для маршрута от вашего текущего места.
      </p>
      <p className="text-sm">
        Статус: <span className="font-semibold">{PERMISSION_TEXT[state]}</span>
        {!geolocationSupported() && " — устройство не поддерживает"}
      </p>
      <button
        type="button"
        onClick={request}
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LocateFixed className="size-4" />
        )}
        {busy ? "Проверяю..." : "Запросить доступ к геолокации"}
      </button>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {brokenBuild && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1">
          <p className="text-sm font-semibold text-destructive">
            APK собран без модуля геолокации
          </p>
          <p className="text-xs text-muted-foreground">
            Поэтому в настройках телефона написано «Разрешений не требуется» и выдать
            доступ невозможно. Нужно пересобрать приложение на компьютере:
          </p>
          <pre className="text-[11px] leading-relaxed overflow-x-auto bg-background/60 rounded-lg p-2">
{`git pull
npm install
npm run build
npx cap sync android
npm run android:fix`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Затем в Android Studio: Build → Clean Project → Build APK(s), удалить старое
            приложение с телефона и установить новый APK.
          </p>
        </div>
      )}

      {!isNativeApp() && (
        <p className="text-xs text-muted-foreground">
          В браузере разрешение выдаётся для сайта, в приложении — в настройках Android.
        </p>
      )}
    </section>
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {

  const [rates, setRates] = useRates();
  const [shiftRates, setShiftRates] = useShiftRates();
  const [settings, setSettings] = useSettings();

  function setRate(
    setter: typeof setRates,
    work: string,
    value: string,
  ) {
    setter((prev) => {
      const next = { ...prev };
      if (!value) delete next[work];
      else next[work] = Number(value);
      return next;
    });
  }

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
              Цены по видам работ, ₽
            </h3>
            <p className="text-sm text-muted-foreground">
              «За час» — сумма заказа считается сама: часы × цена за час. «За смену» —
              фиксированная цена за полный рабочий день.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 items-center pt-1">
              <span />
              <span className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
                За час
              </span>
              <span className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
                За смену
              </span>
            </div>
            <div className="space-y-2">
              {WORK_TYPES.map((w) => (
                <div
                  key={w}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 items-center"
                >
                  <span className="text-sm leading-tight break-words">{w}</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={rates[w] ?? ""}
                    onChange={(e) => setRate(setRates, w, e.target.value)}
                    className="input text-right"
                    placeholder="—"
                    aria-label={`${w}: цена за час`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={shiftRates[w] ?? ""}
                    onChange={(e) => setRate(setShiftRates, w, e.target.value)}
                    className="input text-right"
                    placeholder="—"
                    aria-label={`${w}: цена за смену`}
                  />
                </div>
              ))}
            </div>

          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Транспортировка и смена
            </h3>
            <p className="text-sm text-muted-foreground">
              Цена подачи техники подставится в новый заказ отдельной строкой — её можно
              изменить в самом заказе.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 items-center">
              <span className="text-sm leading-tight">Транспортировка (подача), ₽</span>
              <input
                type="number"
                min="0"
                step="500"
                value={settings.deliveryPrice ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    deliveryPrice: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="input text-right"
                placeholder="—"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 items-center">
              <span className="text-sm leading-tight">Часов в смене</span>
              <input
                type="number"
                min="1"
                step="1"
                value={settings.shiftHours ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    shiftHours: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="input text-right"
                placeholder="8"
              />
            </div>

          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Яндекс.Карты
            </h3>
            <p className="text-sm text-muted-foreground">
              Ключ карты (JavaScript API) уже подставлен. Замените его, если карта не
              грузится.
            </p>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground shrink-0" />
              <input
                value={settings.yandexApiKey ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, yandexApiKey: e.target.value }))
                }
                className="input"
                placeholder={DEFAULT_YANDEX_KEY}
              />
            </div>

            <p className="text-sm text-muted-foreground pt-2">
              Ключ «API Геокодера» — определяет адрес по точке на карте и ищет адрес
              по названию.
            </p>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <input
                value={settings.yandexGeocoderKey ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, yandexGeocoderKey: e.target.value }))
                }
                className="input"
                placeholder={DEFAULT_GEOCODER_KEY}
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

          <GeolocationSection />



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
