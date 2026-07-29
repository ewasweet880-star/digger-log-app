/**
 * Дублирующее хранилище для нативного приложения (Capacitor / Android).
 *
 * В APK страница открывается по server.url, и WebView может очищать
 * localStorage (например, при нехватке места или очистке кеша системой).
 * Поэтому все данные дополнительно пишутся в нативные Preferences —
 * они лежат в памяти телефона и переживают перезапуск приложения.
 */

type PrefsApi = {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
};

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

let prefsPromise: Promise<PrefsApi | null> | null = null;

function getPrefs(): Promise<PrefsApi | null> {
  if (!isNativeApp()) return Promise.resolve(null);
  if (!prefsPromise) {
    prefsPromise = import("@capacitor/preferences")
      .then((m) => m.Preferences as unknown as PrefsApi)
      .catch(() => null);
  }
  return prefsPromise;
}

export async function nativeGet(key: string): Promise<string | null> {
  try {
    const prefs = await getPrefs();
    if (!prefs) return null;
    const { value } = await prefs.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

export function nativeSet(key: string, value: string) {
  void (async () => {
    try {
      const prefs = await getPrefs();
      if (!prefs) return;
      await prefs.set({ key, value });
    } catch (err) {
      console.error("Не удалось сохранить в память телефона", err);
    }
  })();
}
