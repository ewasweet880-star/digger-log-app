/**
 * Построение маршрута к точке заказа в Яндекс.Навигаторе.
 *
 * Точка старта — текущее местоположение (если пользователь разрешил доступ),
 * иначе маршрут строится «от текущего места» силами самого навигатора.
 */

import { getCurrentPosition, geolocationSupported } from "./geo";

export interface RouteTarget {
  lat?: number;
  lng?: number;
  location?: string;
}

export interface StartPoint {
  lat: number;
  lng: number;
}

export function canNavigate(o: RouteTarget) {
  return (typeof o.lat === "number" && typeof o.lng === "number") || Boolean(o.location?.trim());
}

export { geolocationSupported };

/** Запрашивает текущие координаты. Вызывать только после подтверждения пользователя. */
export async function requestCurrentPosition(): Promise<StartPoint | null> {
  const { point } = await getCurrentPosition();
  return point ? { lat: point.lat, lng: point.lng } : null;
}

function webUrl(o: RouteTarget, from?: StartPoint | null) {
  const start = from ? `${from.lat},${from.lng}` : "";
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    return `https://yandex.ru/maps/?rtext=${start}~${o.lat},${o.lng}&rtt=auto`;
  }
  return `https://yandex.ru/maps/?text=${encodeURIComponent(o.location || "")}&rtt=auto`;
}

function appUrl(o: RouteTarget, from?: StartPoint | null) {
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    const fromPart = from ? `lat_from=${from.lat}&lon_from=${from.lng}&` : "";
    return `yandexnavi://build_route_on_map?${fromPart}lat_to=${o.lat}&lon_to=${o.lng}`;
  }
  return `yandexnavi://map_search?text=${encodeURIComponent(o.location || "")}`;
}

export function openNavigator(o: RouteTarget, from?: StartPoint | null) {
  if (typeof window === "undefined" || !canNavigate(o)) return;

  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isMobile) {
    window.open(webUrl(o, from), "_blank", "noopener");
    return;
  }

  // пробуем приложение; если через секунду страница ещё активна — открываем сайт
  let opened = false;
  const onHide = () => {
    opened = true;
  };
  document.addEventListener("visibilitychange", onHide, { once: true });
  window.addEventListener("pagehide", onHide, { once: true });

  window.location.href = appUrl(o, from);

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    if (!opened && !document.hidden) {
      window.location.href = webUrl(o, from);
    }
  }, 1200);
}
