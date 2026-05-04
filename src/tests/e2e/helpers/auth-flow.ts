/**
 * auth-flow.ts — E2E auth flow helpers for full login + setup tests.
 *
 * Goes through the real flow: login page → Google sign-in (test mode) → stores → setup → cashier.
 * Each test gets a unique store. Use setMswFixtures() to add products/categories before loginAndSetup().
 *
 * Usage:
 *   await enableTestMode(page);
 *   await setMswFixtures(page, STORE, { Products: [...], Categories: [...] });
 *   const { storeId, spreadsheetId } = await loginAndSetup(page);
 *   // Now at cashier with products
 */
import type { Page } from "@playwright/test";
import { BASE } from "./auth";

export interface FlowResult {
  storeId: string;
  spreadsheetId: string;
  mainSpreadsheetId: string;
}

/**
 * Enable test mode flags before navigation.
 * Must be called before page.goto().
 */
export async function enableTestMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__E2E_SIGNIN__ = true;
    (window as unknown as Record<string, unknown>).__MSW_ENABLED__ = true;
  });
}

/**
 * Go through the full auth flow:
 * 1. Visit /login
 * 2. Click Google sign-in (test mode returns fake user)
 * 3. Redirect to /stores (no stores exist → /setup)
 * 4. Fill setup form with business name
 * 5. Submit → redirect to cashier
 *
 * Returns the storeId and spreadsheet IDs created during setup.
 */
export async function loginAndSetup(page: Page): Promise<FlowResult> {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");

  // Wait for Google sign-in button to be visible
  await page
    .getByRole("button", { name: /google/i })
    .waitFor({ state: "visible" });

  // Click sign-in - test mode returns fake user (handled in Login page)
  await page.getByRole("button", { name: /google/i }).click();

  // Wait for redirect to stores (will redirect to setup since no stores)
  await page.waitForURL("**/setup", { timeout: 15000 });

  // Fill setup form
  const businessNameInput = page.getByLabel(/Nama Usaha/i);
  await businessNameInput.waitFor({ state: "visible" });
  await businessNameInput.fill("E2E Test Store");

  // Submit setup
  await page.getByRole("button", { name: /Mulai Sekarang/i }).click();

  // Wait for redirect to cashier
  await page.waitForURL("**/cashier", { timeout: 20000 });

  // Extract storeId from URL: /pos-umkm/{storeId}/cashier
  const url = page.url();
  const match = url.match(/\/pos-umkm\/([^/]+)\/cashier/);
  const storeId = match?.[1] ?? "unknown";

  // Inject auth state to localStorage for subsequent navigations
  await page.addInitScript(
    ({ storeId }) => {
      localStorage.setItem(
        "pos-umkm-auth",
        JSON.stringify({
          state: {
            user: {
              id: "e2e-user-1",
              email: "owner@e2e.test",
              name: "E2E Owner",
              role: "owner",
            },
            role: "owner",
            isAuthenticated: true,
            mainSpreadsheetId: "new-sheet-id",
            activeStoreId: storeId,
          },
          version: 0,
        }),
      );
    },
    { storeId },
  );

  return {
    storeId,
    spreadsheetId: "new-sheet-id",
    mainSpreadsheetId: "new-sheet-id",
  };
}

/**
 * Navigate to a specific page within the store.
 * Useful for tests that need to go to catalog, reports, etc.
 */
export async function navigateToStorePage(
  page: Page,
  storeId: string,
  path: string,
  waitForSelector?: string,
): Promise<void> {
  await page.goto(`${BASE}/${storeId}/${path}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  if (waitForSelector) {
    await page.locator(waitForSelector).first().waitFor({ timeout: 10000 });
  }
}
