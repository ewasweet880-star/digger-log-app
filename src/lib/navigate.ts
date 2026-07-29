/**
 * Построение маршрута к точке заказа в Яндекс.Навигаторе.
 *
 * На телефоне сначала пробуем открыть приложение по deeplink
 * (yandexnavi://), а если его нет — уходим на веб-версию Яндекс.Карт.
 */

export interface RouteTarget {
  lat?: number;
  lng?: number;
  location?: string;
}

export function canNavigate(o: RouteTarget) {
  return (
    (typeof o.lat === "number" && typeof o.lng === "number") ||
    Boolean(o.location?.trim())
  );
}

function webUrl(o: RouteTarget) {
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    // rtext=~lat,lon — маршрут «от текущего места» до точки, на авто
    return `https://yandex.ru/maps/?rtext=~${o.lat},${o.lng}&rtt=auto`;
  }
  return `https://yandex.ru/maps/?text=${encodeURIComponent(o.location || "")}&rtt=auto`;
}

function appUrl(o: RouteTarget) {
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    return `yandexnavi://build_route_on_map?lat_to=${o.lat}&lon_to=${o.lng}`;
  }
  return `yandexnavi://map_search?text=${encodeURIComponent(o.location || "")}`;
}

export function openNavigator(o: RouteTarget) {
  if (typeof window === "undefined" || !canNavigate(o)) return;

  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isMobile) {
    window.open(webUrl(o), "_blank", "noopener");
    return;
  }

  // пробуем приложение; если через секунду страница ещё активна — открываем сайт
  let opened = false;
  const onHide = () => {
    opened = true;
  };
  document.addEventListener("visibilitychange", onHide, { once: true });
  window.addEventListener("pagehide", onHide, { once: true });

  window.location.href = appUrl(o);

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    if (!opened && !document.hidden) {
      window.location.href = webUrl(o);
    }
  }, 1200);
}
