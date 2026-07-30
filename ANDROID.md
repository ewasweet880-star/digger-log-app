# Сборка Android APK (Capacitor)

Внутри Lovable APK не собирается — сборка идёт локально в Android Studio.

## Что нужно
- Android Studio (последняя версия) + Android SDK
- JDK 17
- Node.js 20+

## Шаги
1. Экспортируйте проект в GitHub (кнопка **GitHub → Export to GitHub** справа сверху) и клонируйте репозиторий:
   ```bash
   git clone <ваш-репозиторий>
   cd <папка-проекта>
   npm install
   ```
2. Добавьте платформу Android (один раз):
   ```bash
   npx cap add android
   ```
3. Соберите веб-часть и синхронизируйте:
   ```bash
   npm run build
   npx cap sync android
   ```
4. Откройте нативный проект:
   ```bash
   npx cap open android
   ```
5. В Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
   Готовый файл: `android/app/build/outputs/apk/debug/app-debug.apk` — его можно скинуть отцу на телефон и установить.

## Про `capacitor.config.ts`
Сейчас в конфиге указан `server.url` — приложение открывает живую версию сайта, поэтому любые обновления в Lovable сразу видны в APK без пересборки. Требуется интернет.

Опубликуете проект — замените `server.url` на ваш домен (`https://<ваш-проект>.lovable.app`), затем `npx cap sync android`.

## После каждого обновления кода
```bash
git pull
npm install
npm run build
npx cap sync android
```
`npx cap sync android` обязателен после добавления плагина `@capacitor/preferences` — иначе заказы не сохранятся в памяти телефона.


## Релизный APK (для установки без предупреждений)
В Android Studio: **Build → Generate Signed Bundle / APK → APK**, создайте keystore и сохраните его — он нужен для всех будущих обновлений.

## Геолокация

Приложение определяет текущее местоположение (кнопка «Я здесь» на карте и точка
старта маршрута). Используется плагин `@capacitor/geolocation`.

### Если в настройках приложения нет пункта «Геоданные»

Значит папка `android/` была создана до установки плагина, и разрешения не попали
в манифест. Выполните:

```bash
git pull
npm install
npm run build
npx cap sync android
```

Затем откройте `android/app/src/main/AndroidManifest.xml` и убедитесь, что внутри
`<manifest>` (до `<application>`) есть:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```

Если строк нет — добавьте вручную и пересоберите APK
(**Build → Build Bundle(s)/APK(s) → Build APK(s)**), затем переустановите приложение
на телефоне (лучше удалить старое).

### Как выдать доступ

1. В приложении: **Настройки → Геолокация → «Запросить доступ к геолокации»** —
   Android покажет системный диалог. После первого запроса пункт «Геоданные»
   появляется в настройках приложения.
2. Вручную: «Настройки → Приложения → Смена → Разрешения → Геоданные → Разрешить».
3. Включите GPS в шторке телефона — без него координаты не приходят.

В разделе «Настройки → Геолокация» показывается текущий статус разрешения — по нему
удобно понять, дело в разрешении или в выключенном GPS.

