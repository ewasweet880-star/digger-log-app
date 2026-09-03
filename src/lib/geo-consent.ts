export type GeoConsent = "granted" | "declined";

const CONSENT_KEY = "tracker:geo-consent";

export function readGeoConsent(): GeoConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function saveGeoConsent(value: GeoConsent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage is optional; the permission decision can be made again later.
  }
}

export function clearGeoConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
