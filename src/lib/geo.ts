/**
 * Определение текущего местоположения.
 *
 * В нативном приложении (APK) сначала пробуем плагин Capacitor Geolocation —
 * только он умеет запросить системное разрешение Android (после этого пункт
 * «Геоданные» появляется в настройках приложения). Если моста Capacitor нет
 * (страница открыта по server.url и bridge не поднялся) — работаем через
 * обычный navigator.geolocation WebView.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export type GeoError = "unsupported" | "denied" | "unavailable" | "timeout";

export interface GeoResult {
  point?: GeoPoint;
  error?: GeoError;
}

export const GEO_ERROR_TEXT: Record<GeoError, string> = {
  unsupported: "Устройство не поддерживает определение местоположения.",
  denied:
    "Доступ к геолокации запрещён. Откройте «Настройки → Приложения → Смена → Разрешения → Геоданные» и включите доступ.",
  unavailable:
    "Не удалось определить местоположение. Включите GPS и попробуйте ещё раз.",
  timeout:
    "Не удалось получить координаты за 20 секунд. Проверьте, что GPS включён, выйдите на открытое место и попробуйте ещё раз.",
};

const PERMISSION_TIMEOUT_MS = 10_000;
const POSITION_TIMEOUT_MS = 20_000;

class GeoTimeoutError extends Error {}

/** Android WebView и некоторые прошивки иногда игнорируют timeout плагина. */
function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new GeoTimeoutError("Geolocation timeout")),
      milliseconds,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function geolocationSupported() {
  return (
    isNativeApp() || (typeof navigator !== "undefined" && "geolocation" in navigator)
  );
}

type GeoPlugin = {
  checkPermissions(): Promise<{ location: string; coarseLocation?: string }>;
  requestPermissions(o?: {
    permissions?: string[];
  }): Promise<{ location: string; coarseLocation?: string }>;
  getCurrentPosition(o?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }>;
};

let pluginPromise: Promise<GeoPlugin | null> | null = null;

/**
 * Плагин пробуем подгрузить всегда, когда есть объект Capacitor: даже если
 * isNativePlatform() ещё не отвечает, вызовы просто отработают ошибкой и мы
 * упадём на браузерный путь.
 */
function getPlugin(): Promise<GeoPlugin | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const hasCapacitor = Boolean(
    (window as unknown as { Capacitor?: unknown }).Capacitor,
  );
  if (!hasCapacitor) return Promise.resolve(null);
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/geolocation")
      .then((m) => (m.Geolocation as unknown as GeoPlugin) ?? null)
      .catch(() => null);
  }
  return pluginPromise;
}

/** Доступен ли нативный плагин геолокации (мост Capacitor поднялся). */
export async function nativeGeolocationAvailable(): Promise<boolean> {
  return Boolean(await getPlugin());
}

export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

function normalize(status: {
  location?: string;
  coarseLocation?: string;
}): PermissionState {
  const v = [status.location, status.coarseLocation];
  if (v.includes("granted")) return "granted";
  if (v.includes("denied")) return "denied";
  if (v.includes("prompt") || v.includes("prompt-with-rationale")) return "prompt";
  return "unknown";
}

/** Текущее состояние разрешения (без запроса окна). */
export async function checkLocationPermission(): Promise<PermissionState> {
  const plugin = await getPlugin();
  if (plugin) {
    try {
      return normalize(
        await withTimeout(plugin.checkPermissions(), PERMISSION_TIMEOUT_MS),
      );
    } catch {
      return "unknown";
    }
  }
  try {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!perms?.query) return "unknown";
    const res = await perms.query({ name: "geolocation" as PermissionName });
    return res.state as PermissionState;
  } catch {
    return "unknown";
  }
}

/**
 * Запрашивает системное разрешение. В нативном приложении именно этот вызов
 * заставляет Android показать диалог и добавить пункт в настройки приложения.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return true; // в WebView разрешение спросит сам getCurrentPosition
  try {
    let state = normalize(
      await withTimeout(plugin.checkPermissions(), PERMISSION_TIMEOUT_MS),
    );
    if (state !== "granted") {
      state = normalize(
        await withTimeout(
          plugin.requestPermissions({ permissions: ["location", "coarseLocation"] }),
          PERMISSION_TIMEOUT_MS,
        ),
      );
    }
    return state === "granted";
  } catch {
    // Плагин недоступен (нет моста) — пусть попробует WebView.
    return true;
  }
}

function browserPosition(): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve({ error: "unsupported" });
  }
  return new Promise<GeoResult>((resolve) => {
    let finished = false;
    const finish = (result: GeoResult) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      resolve(result);
    };
    const watchdog = window.setTimeout(
      () => finish({ error: "timeout" }),
      POSITION_TIMEOUT_MS,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        finish({
          point: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) =>
        finish({
          error:
            err.code === err.PERMISSION_DENIED
              ? "denied"
              : err.code === err.TIMEOUT
                ? "timeout"
                : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: POSITION_TIMEOUT_MS, maximumAge: 120000 },
    );
  });
}

/** Возвращает текущие координаты. Вызывать только после подтверждения пользователем. */
export async function getCurrentPosition(): Promise<GeoResult> {
  const plugin = await getPlugin();

  if (plugin) {
    const allowed = await ensureLocationPermission();
    if (!allowed) return { error: "denied" };
    try {
      const pos = await withTimeout(
        plugin.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: POSITION_TIMEOUT_MS,
          maximumAge: 120000,
        }),
        POSITION_TIMEOUT_MS,
      );
      return {
        point: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
      };
    } catch (error) {
      // После реального тайм-аута не запускаем ещё один долгий поиск в WebView.
      if (error instanceof GeoTimeoutError) return { error: "timeout" };
      // При ошибке плагина пробуем WebView: часть прошивок отдаёт координаты сама.
      const fallback = await browserPosition();
      return fallback;
    }
  }

  return browserPosition();
}
