/** HTTP Геокодер Яндекса (ключ «API Геокодера»). */
const BASE = "https://geocode-maps.yandex.ru/1.x/";

async function request(apiKey: string, geocode: string) {
  const url = `${BASE}?apikey=${encodeURIComponent(apiKey)}&format=json&results=1&lang=ru_RU&geocode=${encodeURIComponent(geocode)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Геокодер недоступен");
  const data = await res.json();
  const member = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  if (!member) return null;
  const [lng, lat] = String(member.Point?.pos ?? "").split(" ").map(Number);
  const address: string =
    member.metaDataProperty?.GeocoderMetaData?.text ?? member.name ?? "";
  return { lat, lng, address };
}

/** Координаты -> адрес */
export function reverseGeocode(apiKey: string, lat: number, lng: number) {
  return request(apiKey, `${lng},${lat}`);
}

/** Адрес -> координаты */
export function forwardGeocode(apiKey: string, text: string) {
  return request(apiKey, text);
}
