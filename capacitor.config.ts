import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.diggerlog",
  appName: "Смена",
  // build:capacitor creates a self-contained web bundle. The APK therefore
  // remains usable without a network connection; Yandex services are optional.
  webDir: "capacitor-dist",
  server: {
    cleartext: true,
    androidScheme: "https",
    allowNavigation: ["api-maps.yandex.ru", "geocode-maps.yandex.ru", "yandex.ru", "*.yandex.ru"],
  },
  android: {
    backgroundColor: "#0e0f11",
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0e0f11",
      androidSpinnerStyle: "small",
      showSpinner: false,
    },
    Geolocation: {},
  },
};

export default config;
