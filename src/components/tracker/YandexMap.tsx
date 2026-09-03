import { useEffect, useRef, useState } from "react";
import { useGeocoderKey, useYandexKey } from "@/lib/tracker-storage";
import { forwardGeocode, reverseGeocode } from "@/lib/yandex-geocode";
import { Crosshair, Loader2, LocateFixed, Search } from "lucide-react";
import { GEO_ERROR_TEXT, geolocationSupported, getCurrentPosition } from "@/lib/geo";

interface YandexEvent {
  get(name: string): number[];
}

interface YandexEventManager {
  add(name: string, handler: (event: YandexEvent) => void): void;
}

interface YandexGeometry {
  getCoordinates(): number[];
  setCoordinates(coords: number[]): void;
}

interface YandexPlacemark {
  geometry: YandexGeometry;
  events: YandexEventManager;
}

interface YandexMapInstance {
  events: YandexEventManager;
  geoObjects: { add(object: YandexPlacemark): void };
  setCenter(coords: number[], zoom: number): void;
  destroy(): void;
}

interface YandexMapsApi {
  ready(callback: () => void): void;
  Map: new (
    element: HTMLElement,
    state: { center: number[]; zoom: number; controls: string[] },
    options: { suppressMapOpenBlock: boolean },
  ) => YandexMapInstance;
  Placemark: new (
    coords: number[],
    properties: Record<string, never>,
    options: { draggable: boolean; preset: string },
  ) => YandexPlacemark;
}

declare global {
  interface Window {
    ymaps?: YandexMapsApi;
  }
}

let loaderPromise: Promise<YandexMapsApi> | null = null;

function loadYmaps(apiKey: string): Promise<YandexMapsApi> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<YandexMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Не удалось загрузить Яндекс.Карты"));
    };
    script.onload = () => {
      if (!window.ymaps) {
        loaderPromise = null;
        reject(new Error("Яндекс.Карты не инициализировались"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

interface Props {
  lat?: number;
  lng?: number;
  address: string;
  onPick: (lat: number, lng: number, address?: string) => void;
}

const DEFAULT_CENTER = [55.751244, 37.618423]; // Москва

export function YandexMap({ lat, lng, address, onPick }: Props) {
  const apiKey = useYandexKey();
  const geocoderKey = useGeocoderKey();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const markRef = useRef<YandexPlacemark | null>(null);
  const ymapsRef = useRef<YandexMapsApi | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const geoKeyRef = useRef(geocoderKey);
  geoKeyRef.current = geocoderKey;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    loadYmaps(apiKey)
      .then((ymaps) => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        ymapsRef.current = ymaps;
        const center = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
        const map = new ymaps.Map(
          boxRef.current,
          // Встроенный geolocationControl Яндекса использует WebView API и на
          // Android может искать бесконечно. Используем нашу кнопку «Я здесь».
          { center, zoom: lat != null ? 16 : 10, controls: ["zoomControl"] },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        const place = (coords: number[], reverse = true) => {
          const currentMark = markRef.current;
          if (!currentMark) {
            const newMark = new ymaps.Placemark(
              coords,
              {},
              { draggable: true, preset: "islands#orangeDotIcon" },
            );
            markRef.current = newMark;
            newMark.events.add("dragend", () => {
              const current = markRef.current;
              if (current) resolveAddress(current.geometry.getCoordinates());
            });
            map.geoObjects.add(newMark);
          } else {
            currentMark.geometry.setCoordinates(coords);
          }
          if (reverse) resolveAddress(coords);
        };

        const resolveAddress = (coords: number[]) => {
          onPickRef.current(coords[0], coords[1]);
          reverseGeocode(geoKeyRef.current, coords[0], coords[1])
            .then((r) => {
              onPickRef.current(coords[0], coords[1], r?.address || undefined);
            })
            .catch(() => undefined);
        };

        map.events.add("click", (event) => place(event.get("coords")));
        if (lat != null && lng != null) place([lat, lng], false);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    return () => {
      mapRef.current?.destroy?.();
      mapRef.current = null;
      markRef.current = null;
    };
  }, []);

  /** Ставит/двигает метку и сообщает координаты наверх. */
  function putMarker(coords: number[], zoom = 16) {
    const ymaps = ymapsRef.current;
    const map = mapRef.current;
    if (!ymaps || !map) return;
    map.setCenter(coords, zoom);
    const currentMark = markRef.current;
    if (!currentMark) {
      const newMark = new ymaps.Placemark(
        coords,
        {},
        { draggable: true, preset: "islands#orangeDotIcon" },
      );
      markRef.current = newMark;
      newMark.events.add("dragend", () => {
        const current = markRef.current;
        if (!current) return;
        const nextCoords = current.geometry.getCoordinates();
        onPickRef.current(nextCoords[0], nextCoords[1]);
        reverseGeocode(geoKeyRef.current, nextCoords[0], nextCoords[1])
          .then((rr) => onPickRef.current(nextCoords[0], nextCoords[1], rr?.address || undefined))
          .catch(() => undefined);
      });
      map.geoObjects.add(newMark);
    } else {
      currentMark.geometry.setCoordinates(coords);
    }
  }

  /** Определяет текущее местоположение и ставит метку туда. */
  async function locate() {
    setGeoError(null);
    setLocating(true);
    const { point, error: geoErr } = await getCurrentPosition();
    setLocating(false);
    if (!point) {
      setGeoError(GEO_ERROR_TEXT[geoErr ?? "unavailable"]);
      return;
    }
    putMarker([point.lat, point.lng], 17);
    onPickRef.current(point.lat, point.lng);
    const r = await reverseGeocode(geoKeyRef.current, point.lat, point.lng).catch(() => null);
    onPickRef.current(point.lat, point.lng, r?.address || undefined);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    const ymaps = ymapsRef.current;
    const text = query.trim() || address.trim();
    if (!ymaps || !mapRef.current || !text) return;

    forwardGeocode(geoKeyRef.current, text)
      .then((result) => {
        const map = mapRef.current;
        if (!result || Number.isNaN(result.lat) || !map) return;
        const coords = [result.lat, result.lng];
        map.setCenter(coords, 16);
        const currentMark = markRef.current;
        if (!currentMark) {
          const newMark = new ymaps.Placemark(
            coords,
            {},
            { draggable: true, preset: "islands#orangeDotIcon" },
          );
          markRef.current = newMark;
          newMark.events.add("dragend", () => {
            const current = markRef.current;
            if (!current) return;
            const nextCoords = current.geometry.getCoordinates();
            onPickRef.current(nextCoords[0], nextCoords[1]);
            reverseGeocode(geoKeyRef.current, nextCoords[0], nextCoords[1])
              .then((rr) =>
                onPickRef.current(nextCoords[0], nextCoords[1], rr?.address || undefined),
              )
              .catch(() => undefined);
          });
          map.geoObjects.add(newMark);
        } else {
          currentMark.geometry.setCoordinates(coords);
        }
        onPickRef.current(result.lat, result.lng, result.address || undefined);
      })
      .catch(() => setError("Не удалось найти адрес"));
  }

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Чтобы показывать карту, добавьте бесплатный API-ключ Яндекс.Карт в разделе «Настройки».
        {lat != null && lng != null && (
          <a
            className="block mt-2 text-primary font-semibold"
            href={`https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`}
            target="_blank"
            rel="noreferrer"
          >
            Открыть точку в Яндекс.Картах
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search(e as unknown as React.FormEvent);
          }}
          className="input"
          placeholder={address || "Найти адрес на карте"}
        />
        <button
          type="button"
          onClick={search}
          className="min-h-11 min-w-11 rounded-xl bg-secondary text-secondary-foreground"
          aria-label="Найти"
        >
          <Search className="size-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={locate}
        disabled={locating || !geolocationSupported()}
        className="w-full min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LocateFixed className="size-4" />
        )}
        {locating ? "Определяю..." : "Я здесь — моё местоположение"}
      </button>

      {geoError && <p className="text-xs text-destructive">{geoError}</p>}

      <div className="relative h-56 rounded-xl overflow-hidden border border-border">
        <div ref={boxRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-secondary">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-secondary p-4 text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Crosshair className="size-3.5" />
        {lat != null && lng != null
          ? `Точка: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
          : "Нажмите на карту, чтобы отметить место работы"}
      </p>
    </div>
  );
}
