/**
 * Добавляет разрешения геолокации и медиа в android/app/src/main/AndroidManifest.xml.
 *
 * Запуск: node scripts/android-permissions.mjs  (или npm run android:fix)
 * Нужен, если в настройках телефона у приложения отсутствует доступ к GPS,
 * камере или микрофону.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "android/app/src/main/AndroidManifest.xml";
const CHECK_ONLY = process.argv.includes("--check");

const LINES = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
];

if (!existsSync(FILE)) {
  console.error(`Нет файла ${FILE}. Сначала выполните: npx cap add android`);
  process.exit(1);
}

let xml = readFileSync(FILE, "utf8");
const missing = LINES.filter((l) => !xml.includes(l.split('name="')[1].split('"')[0]));

if (missing.length === 0) {
  console.log("✓ Разрешения геолокации, камеры и микрофона есть в AndroidManifest.xml.");
  process.exit(0);
}

if (CHECK_ONLY) {
  console.error(`Сборка остановлена: в ${FILE} нет разрешений:\n  ${missing.join("\n  ")}`);
  console.error("Выполните npm run android:fix и повторите сборку.");
  process.exit(1);
}

if (!xml.includes("<application")) {
  console.error(`Не найден тег <application> в ${FILE}. Манифест повреждён.`);
  process.exit(1);
}

xml = xml.replace(/<application/, `${missing.join("\n    ")}\n\n    <application`);
writeFileSync(FILE, xml);
console.log(`Добавлено в манифест:\n  ${missing.join("\n  ")}`);

const updated = readFileSync(FILE, "utf8");
const stillMissing = LINES.filter(
  (line) => !updated.includes(line.split('name="')[1].split('"')[0]),
);
if (stillMissing.length > 0) {
  console.error("Не удалось записать разрешения в AndroidManifest.xml.");
  process.exit(1);
}

console.log("✓ Манифест готов. Теперь можно собирать APK с доступом к геолокации и медиа.");
