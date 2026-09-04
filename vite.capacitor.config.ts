import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: "capacitor",
  publicDir: "../public",
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "../capacitor-dist",
    emptyOutDir: true,
  },
});
