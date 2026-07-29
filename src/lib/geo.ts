/**
 * Определение текущего местоположения.
 *
 * В нативном приложении (APK) используется плагин Capacitor Geolocation —
 * он умеет запрашивать системное разрешение Android. В браузере работает
 * стандартный navigator.geolocation.
 */

import { isNativeApp } from "./native-store";

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
    "Доступ к геолокации запрещён. Разрешите его в настройках телефона для этого приложения.",
  unavailable:
    "Не удалось определить местоположение. Включите GPS и попробуйте ещё раз.",
  timeout: "Определение местоположения заняло слишком много времени.",
};

export function geolocationSupported() {
  return (
    isNativeApp() || (typeof navigator !== "undefined" && "geolocation" in navigator)
  );
}

type GeoPlugin = {
  checkPermissions(): Promise<{ location: string; coarseLocation?: string }>;
  requestPermissions(): Promise<{ location: string; coarseLocation?: string }>;
  getCurrentPosition(o?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }>;
};

let pluginPromise: Promise<GeoPlugin | null> | null = null;

function getPlugin(): Promise<GeoPlugin | null> {
  if (!isNativeApp()) return Promise.resolve(null);
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/geolocation")
      .then((m) => m.Geolocation as unknown as GeoPlugin)
      .catch(() => null);
  }
  return pluginPromise;
}

/** Проверяет (и при необходимости запрашивает) разрешение на геолокацию. */
export async function ensureLocationPermission(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return true; // в браузере разрешение спросит сам getCurrentPosition
  try {
    let status = await plugin.checkPermissions();
    if (status.location !== "granted" && status.coarseLocation !== "granted") {
      status = await plugin.requestPermissions();
    }
    return status.location === "granted" || status.coarseLocation === "granted";
  } catch {
    return false;
  }
}

/** Возвращает текущие координаты. Вызывать только после подтверждения пользователем. */
export async function getCurrentPosition(): Promise<GeoResult> {
  if (!geolocationSupported()) return { error: "unsupported" };

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
      return { error: "unavailable" };
    }
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
