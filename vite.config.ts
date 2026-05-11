import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const appBase = "/pos-umkm/";

function normalizeBasePath(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function redirectBaseWithoutTrailingSlash(base: string) {
  const bareBase = normalizeBasePath(base);

  const redirectMiddleware = (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: () => void;
    },
    next: () => void,
  ) => {
    const reqUrl = req.url ?? "";
    if (reqUrl === bareBase) {
      res.statusCode = 302;
      res.setHeader("Location", `${base}`);
      res.end();
      return;
    }
    next();
  };

  return {
    name: "redirect-base-without-trailing-slash",
    configureServer(server: {
      middlewares: { use: (fn: typeof redirectMiddleware) => void };
    }) {
      server.middlewares.use(redirectMiddleware);
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: typeof redirectMiddleware) => void };
    }) {
      server.middlewares.use(redirectMiddleware);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    redirectBaseWithoutTrailingSlash(appBase),
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
