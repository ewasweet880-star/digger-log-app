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
  timeout: "Определение местоположения заняло слишком много времени.",
};

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
      return normalize(await plugin.checkPermissions());
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
    let state = normalize(await plugin.checkPermissions());
    if (state !== "granted") {
      state = normalize(
        await plugin.requestPermissions({ permissions: ["location", "coarseLocation"] }),
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
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          point: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) =>
        resolve({
          error:
            err.code === err.PERMISSION_DENIED
              ? "denied"
              : err.code === err.TIMEOUT
                ? "timeout"
                : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
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
      const pos = await plugin.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
      return {
        point: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
      };
    } catch {
      // Падаем на браузерный путь: часть WebView отдаёт координаты сама.
      const fallback = await browserPosition();
      return fallback.point ? fallback : { error: "unavailable" };
    }
  }

  return browserPosition();
}
