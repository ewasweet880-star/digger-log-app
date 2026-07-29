import { useEffect, useRef, useState } from "react";
import { useGeocoderKey, useYandexKey } from "@/lib/tracker-storage";
import { forwardGeocode, reverseGeocode } from "@/lib/yandex-geocode";
import { Crosshair, Loader2, LocateFixed, Search } from "lucide-react";
import { GEO_ERROR_TEXT, geolocationSupported, getCurrentPosition } from "@/lib/geo";


declare global {
  interface Window {
    ymaps?: any;
  }
}

let loaderPromise: Promise<any> | null = null;

function loadYmaps(apiKey: string) {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
      apiKey,
    )}&lang=ru_RU`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Не удалось загрузить Яндекс.Карты"));
    };
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
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
  const mapRef = useRef<any>(null);
  const markRef = useRef<any>(null);
  const ymapsRef = useRef<any>(null);
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
          { center, zoom: lat != null ? 16 : 10, controls: ["zoomControl", "geolocationControl"] },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        const place = (coords: number[], reverse = true) => {
          if (!markRef.current) {
            markRef.current = new ymaps.Placemark(
              coords,
              {},
              { draggable: true, preset: "islands#orangeDotIcon" },
            );
            markRef.current.events.add("dragend", () => {
              const c = markRef.current.geometry.getCoordinates();
              resolveAddress(c);
            });
            map.geoObjects.add(markRef.current);
          } else {
            markRef.current.geometry.setCoordinates(coords);
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


        map.events.add("click", (e: any) => place(e.get("coords")));
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
    if (!ymaps || !mapRef.current) return;
    mapRef.current.setCenter(coords, zoom);
    if (!markRef.current) {
      markRef.current = new ymaps.Placemark(
        coords,
        {},
        { draggable: true, preset: "islands#orangeDotIcon" },
      );
      markRef.current.events.add("dragend", () => {
        const c = markRef.current.geometry.getCoordinates();
        onPickRef.current(c[0], c[1]);
        reverseGeocode(geoKeyRef.current, c[0], c[1])
          .then((rr) => onPickRef.current(c[0], c[1], rr?.address || undefined))
          .catch(() => undefined);
      });
      mapRef.current.geoObjects.add(markRef.current);
    } else {
      markRef.current.geometry.setCoordinates(coords);
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
    const r = await reverseGeocode(geoKeyRef.current, point.lat, point.lng).catch(
      () => null,
    );
    onPickRef.current(point.lat, point.lng, r?.address || undefined);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    const ymaps = ymapsRef.current;
    const text = query.trim() || address.trim();
    if (!ymaps || !mapRef.current || !text) return;

    forwardGeocode(geoKeyRef.current, text)
      .then((r) => {
        if (!r || Number.isNaN(r.lat)) return;
        const coords = [r.lat, r.lng];
        mapRef.current.setCenter(coords, 16);
        if (!markRef.current) {
          markRef.current = new ymaps.Placemark(
            coords,
            {},
            { draggable: true, preset: "islands#orangeDotIcon" },
          );
          markRef.current.events.add("dragend", () => {
            const c = markRef.current.geometry.getCoordinates();
            onPickRef.current(c[0], c[1]);
            reverseGeocode(geoKeyRef.current, c[0], c[1])
              .then((rr) => onPickRef.current(c[0], c[1], rr?.address || undefined))
              .catch(() => undefined);
          });
          mapRef.current.geoObjects.add(markRef.current);
        } else {
          markRef.current.geometry.setCoordinates(coords);
        }
        onPickRef.current(r.lat, r.lng, r.address || undefined);
      })
      .catch(() => setError("Не удалось найти адрес"));

  }

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Чтобы показывать карту, добавьте бесплатный API-ключ Яндекс.Карт в разделе
        «Настройки».
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
          className="px-4 rounded-xl bg-secondary text-secondary-foreground"
          aria-label="Найти"
        >
          <Search className="size-5" />
        </button>
      </div>

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
