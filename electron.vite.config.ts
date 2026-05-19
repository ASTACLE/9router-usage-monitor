import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, "electron/main.ts") } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, "electron/preload.ts") } } },
  },
  renderer: {
    root: ".",
    plugins: [vue(), UnoCSS()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: { rollupOptions: { input: { index: resolve(__dirname, "index.html") } } },
  },
});
