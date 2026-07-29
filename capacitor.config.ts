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
  },
  android: {
    backgroundColor: "#0e0f11",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0e0f11",
      androidSpinnerStyle: "small",
      showSpinner: false,
    },
  },
};

export default config;
