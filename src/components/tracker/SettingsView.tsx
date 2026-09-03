import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_GEOCODER_KEY,
  DEFAULT_YANDEX_KEY,
  useClients,
  useExpenses,
  useOrders,
  useRates,
  useSettings,
  useShiftRates,
  WORK_TYPES,
} from "@/lib/tracker-storage";
import { createBackup, parseBackup, type BackupData } from "@/lib/backup";
import { toISODate } from "@/lib/date-utils";
import {
  checkLocationPermission,
  geolocationSupported,
  getCurrentPosition,
  isNativeApp,
  nativeGeolocationAvailable,
  type PermissionState,
} from "@/lib/geo";
import { clearGeoConsent } from "@/lib/geo-consent";
import {
  Download,
  ExternalLink,
  FileJson,
  KeyRound,
  Loader2,
  LocateFixed,
  MapPin,
  Upload,
  X,
} from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDialog } from "@/hooks/use-dialog";

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: "Доступ разрешён",
  denied: "Доступ запрещён",
  prompt: "Разрешение ещё не запрошено",
  unknown: "Состояние неизвестно",
};

function GeolocationSection({ onOpenGeoScreen }: { onOpenGeoScreen?: () => void }) {
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
        setNote(`Местоположение получено: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
      } else if (error === "denied") {
        setNote(
          "Android отказал в доступе. Откройте «Настройки → Приложения → Смена → Разрешения → Геоданные» и включите доступ. Если такого пункта нет — APK собран без разрешения, нужна пересборка (см. ниже).",
        );
      } else if (error === "timeout") {
        setNote(
          "Телефон не отдал координаты за 15 секунд. Включите геолокацию и точность Google/сетей в настройках телефона, затем повторите.",
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
        {busy ? "Проверяю..." : "Запросить доступ к геолокации"}
      </button>
      {onOpenGeoScreen && (
        <button
          type="button"
          onClick={() => {
            clearGeoConsent();
            onOpenGeoScreen();
          }}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold"
        >
          Открыть экран разрешения
        </button>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {brokenBuild && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1">
          <p className="text-sm font-semibold text-destructive">APK собран без модуля геолокации</p>
          <p className="text-xs text-muted-foreground">
            Поэтому в настройках телефона написано «Разрешений не требуется» и выдать доступ
            невозможно. Нужно пересобрать приложение на компьютере:
          </p>
          <pre className="text-[11px] leading-relaxed overflow-x-auto bg-background/60 rounded-lg p-2">
            {`git pull
npm install
npm run build
npx cap sync android
npm run android:fix`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Затем в Android Studio: Build → Clean Project → Build APK(s), удалить старое приложение
            с телефона и установить новый APK.
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

export function SettingsView({
  onClose,
  onOpenGeoScreen,
}: {
  onClose: () => void;
  onOpenGeoScreen?: () => void;
}) {
  const [rates, setRates] = useRates();
  const [shiftRates, setShiftRates] = useShiftRates();
  const [settings, setSettings] = useSettings();
  const [orders, setOrders] = useOrders();
  const [clients, setClients] = useClients();
  const [expenses, setExpenses] = useExpenses();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  useDialog(true, () => {
    if (pendingBackup) setPendingBackup(null);
    else onClose();
  });

  async function exportBackup() {
    const backup = createBackup({
      orders,
      clients,
      expenses,
      rates,
      shiftRates,
      settings,
    });
    const filename = `smena-backup-${toISODate(new Date())}.json`;
    const json = JSON.stringify(backup, null, 2);
    const file = new File([json], filename, { type: "application/json" });

    // On Android, sharing a file is more reliable than relying on the WebView
    // download handler. Browsers without file sharing use the normal download.
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: "Резервная копия «Смена»",
          files: [file],
        });
        setBackupError(null);
        setBackupMessage("Резервная копия отправлена в меню «Поделиться».");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupError(null);
    setBackupMessage("Резервная копия скачана.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setBackupError(null);
      setBackupMessage(null);
      setPendingBackup(backup);
    } catch (error) {
      setBackupMessage(null);
      setBackupError(error instanceof Error ? error.message : "Не удалось прочитать файл.");
    }
  }

  function applyBackup() {
    if (!pendingBackup) return;
    setOrders(pendingBackup.orders);
    setClients(pendingBackup.clients);
    setExpenses(pendingBackup.expenses);
    setRates(pendingBackup.rates);
    setShiftRates(pendingBackup.shiftRates);
    setSettings(pendingBackup.settings);
    setPendingBackup(null);
    setBackupError(null);
    setBackupMessage("Резервная копия восстановлена.");
  }

  function setRate(setter: typeof setRates, work: string, value: string) {
    setter((prev) => {
      const next = { ...prev };
      if (!value) delete next[work];
      else next[work] = Number(value);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-card border-t sm:border border-border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
          <h2 id="settings-title" className="font-display text-xl uppercase tracking-wide">
            Настройки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg hover:bg-accent"
            aria-label="Закрыть настройки"
          >
            <X className="mx-auto size-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Цены по видам работ, ₽
            </h3>
            <p className="text-sm text-muted-foreground">
              «За час» — сумма заказа считается сама: часы × цена за час. «За смену» — фиксированная
              цена за полный рабочий день.
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
              Цена подачи техники подставится в новый заказ отдельной строкой — её можно изменить в
              самом заказе.
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
              Ключ карты (JavaScript API) уже подставлен. Замените его, если карта не грузится.
            </p>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground shrink-0" />
              <input
                value={settings.yandexApiKey ?? ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, yandexApiKey: e.target.value }))}
                className="input"
                placeholder={DEFAULT_YANDEX_KEY}
              />
            </div>

            <p className="text-sm text-muted-foreground pt-2">
              Ключ «API Геокодера» — определяет адрес по точке на карте и ищет адрес по названию.
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

          <section className="space-y-3">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Резервная копия
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Сохраняет заказы, клиентов, расходы, ставки и настройки в файл на телефоне.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportBackup}
                className="min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Download className="size-4" /> Скачать
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Upload className="size-4" /> Восстановить
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importBackup}
              className="sr-only"
              aria-label="Выбрать резервную копию"
            />
            {backupMessage && (
              <p className="text-sm text-[color:var(--success)] inline-flex items-center gap-1">
                <FileJson className="size-4" /> {backupMessage}
              </p>
            )}
            {backupError && <p className="text-sm text-destructive">{backupError}</p>}
          </section>

          <GeolocationSection onOpenGeoScreen={onOpenGeoScreen} />
        </div>

        <div className="sticky bottom-0 p-4 bg-card border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-12 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide"
          >
            Готово
          </button>
        </div>
      </div>
      {pendingBackup && (
        <ConfirmDialog
          title="Восстановить копию?"
          description="Текущие заказы, клиенты, расходы и настройки будут заменены данными из файла. Сначала скачайте текущую копию, если она нужна."
          confirmLabel="Заменить данные"
          onCancel={() => setPendingBackup(null)}
          onConfirm={applyBackup}
        />
      )}
    </div>
  );
}
