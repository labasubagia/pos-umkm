import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    // Port 5174 is reserved for Playwright — separate from the dev server on 5173.
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5174",
    url: "http://localhost:5174/pos-umkm/",
    reuseExistingServer: !process.env.CI,
    env: {
      // VITE_E2E exposes window.__getDb for Dexie seeding in specs.
      VITE_E2E: "true",
    },
  },
});
