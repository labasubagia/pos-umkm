/**
 * auth.ts — E2E auth injection and navigation helpers.
 *
 * Injects auth state into localStorage before the page loads so that:
 *   1. GoogleAuthAdapter.restoreSession() returns the fake user immediately
 *      (reads `gsi_*` keys — no OAuth popup needed).
 *   2. Zustand `persist` middleware rehydrates the auth store from the injected
 *      `pos-umkm-auth` key, so ProtectedRoute sees isAuthenticated=true on the
 *      first render.
 *
 * Google API calls are handled by the MSW service worker (activated via
 * window.__MSW_ENABLED__ = true set here). For tests that need precise control
 * over specific routes (e.g. store-management.spec.ts), use page.route() in
 * the test — Playwright CDP routing takes precedence over the MSW worker.
 *
 * Usage:
 *   await setMswFixtures(page, store, { Products: [...], ... })  // optional
 *   await injectAuthState(page, storeConfig)
 *   await page.goto(`${BASE}/${store.storeId}/cashier`)
 *   await page.locator('[data-testid^="product-card-"]').first().waitFor()
 */
import type { Page } from "@playwright/test";

export const BASE = "/pos-umkm";

export interface StoreConfig {
  storeId: string;
  mainSpreadsheetId: string;
}

export const DEFAULT_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
};

/**
 * Injects GoogleAuthAdapter session tokens + Zustand auth state + store map
 * into localStorage via page.addInitScript (runs before any page JavaScript).
 * Must be called before page.goto().
 */
export async function injectAuthState(
  page: Page,
  store: StoreConfig = DEFAULT_STORE,
): Promise<void> {
  // Activate the MSW service worker so Sheets/Drive API calls are intercepted
  // without needing real credentials. setMswFixtures() can be called before
  // this function to pre-populate window.__E2E_FIXTURES__ with test data.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__MSW_ENABLED__ = true;
  });

  await page.addInitScript(
    ({ store }) => {
      // GoogleAuthAdapter reads these to restore session without OAuth popup.
      localStorage.setItem("gsi_access_token", "fake-e2e-token");
      localStorage.setItem("gsi_token_expiry", String(Date.now() + 3_600_000));
      localStorage.setItem("gsi_user_id", "e2e-owner-1");
      localStorage.setItem("gsi_user_email", "owner@e2e.test");
      localStorage.setItem("gsi_user_name", "E2E Owner");

      // Zustand persist key — rehydrates isAuthenticated + sheet IDs on load.
      localStorage.setItem(
        "pos-umkm-auth",
        JSON.stringify({
          state: {
            user: {
              id: "e2e-owner-1",
              email: "owner@e2e.test",
              name: "E2E Owner",
              role: "owner",
            },
            role: "owner",
            isAuthenticated: true,
            mainSpreadsheetId: store.mainSpreadsheetId,
            activeStoreId: store.storeId,
          },
          version: 0,
        }),
      );

      // Legacy keys used by setup.service helpers.
      localStorage.setItem("mainSpreadsheetId", store.mainSpreadsheetId);

      // Store map: only storeFolderId is injected. sheets and monthlySheets are
      // intentionally left empty — AppShell.ensureStoreMapReady() will traverse
      // the Drive mock (which returns a "main" spreadsheet + a "transaction_YYYY-MM"
      // spreadsheet) and populate both fields before hydration runs.
      localStorage.setItem(
        `pos_umkm_storemap_${store.storeId}`,
        JSON.stringify({
          state: {
            storeFolderId: "e2e-folder-id",
            sheets: {},
            monthlySheets: {},
            lastTraversedAt: null,
          },
          version: 0,
        }),
      );
    },
    { store },
  );
}

/**
 * Navigate within the SPA without a hard reload, preserving in-memory
 * React/Zustand state. Pushes a history entry and fires popstate so React
 * Router picks it up — equivalent to clicking a <Link>.
 *
 * When `readyTestId` is provided, waits for that element to appear before
 * returning — avoiding race conditions where callers interact with elements
 * that haven't rendered yet.
 */
export async function navigateTo(
  page: Page,
  path: string,
  readyTestId?: string,
): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  if (readyTestId) {
    await page.getByTestId(readyTestId).waitFor();
  }
}
