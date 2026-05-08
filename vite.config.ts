import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const appBase = "/pos-umkm/";

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "pwa-icon.svg", "pwa-icon-maskable.svg"],
      manifest: {
        name: "POS UMKM",
        short_name: "POS UMKM",
        description:
          "Offline-first point of sale for Indonesian small businesses.",
        theme_color: "#7e14ff",
        background_color: "#ffffff",
        display: "standalone",
        scope: appBase,
        start_url: appBase,
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "pwa-icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{css,html,js,json,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/pos-umkm\/mockServiceWorker\.js$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
