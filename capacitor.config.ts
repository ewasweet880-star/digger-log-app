import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.81bd95a7d973484bbf89af068ce1d2cb",
  appName: "Смена",
  // Каталог со статикой. Приложение работает по server.url (см. ниже),
  // но Capacitor требует существующую папку — используем public/.
  webDir: "public",
  server: {
    // Приложение на TanStack Start рендерится на сервере, поэтому APK
    // загружает живую версию сайта. Замените на ваш published-домен,
    // когда опубликуете проект.
    url: "https://digger-log-app.lovable.app?forceHideBadge=true",
    cleartext: true,
    androidScheme: "https",
    // Домены, внутри которых работает мост Capacitor (нужно для геолокации).
    allowNavigation: [
      "digger-log-app.lovable.app",
      "*.lovable.app",
      "*.lovableproject.com",
      "api-maps.yandex.ru",
      "geocode-maps.yandex.ru",
    ],
  },
  android: {
    backgroundColor: "#0e0f11",
    // Нужно, чтобы WebView отдавал координаты странице, загруженной по https.
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
    Geolocation: {
      // Плагин добавляет в манифест ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION,
      // благодаря чему в настройках приложения появляется пункт «Геоданные».
    },
  },
};

export default config;
