/**
 * auth-flow.ts — E2E auth flow helpers for full login + setup tests.
 *
 * Goes through the real flow: login page → Google sign-in (test mode) → stores → setup → cashier.
 * Each test gets a unique store.
 *
 * Usage (preferred — single entry point):
 *   const { storeId } = await setup(page, { Products: [...], Categories: [...] });
 *   // Now at cashier with products already in MSW fixtures
 *
 * setup() always runs: setMswFixtures → enableTestMode → loginAndSetup
 * Pass an empty object (or omit) when no pre-seeded fixtures are needed.
 */
import type { Page } from "@playwright/test";
import { BASE, type StoreConfig } from "./auth";
import { type FixtureTables, setMswFixtures } from "./msw-state";

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

  // The main spreadsheet ID is always "e2e-main-id" in E2E tests — the MSW
  // Drive handler returns this ID from its getActiveSpreadsheetId() default.
  const E2E_MAIN_SPREADSHEET_ID = "e2e-main-id";
  // The store folder ID is always "new-e2e-id" — MSW returns this from every
  // POST /drive/v3/files call during store folder creation.
  const E2E_STORE_FOLDER_ID = "new-e2e-id";

  // Inject Stores fixture so ensureStoreMapReady() can look up the store's
  // drive_folder_id on any subsequent page reload (storeMap is in-memory only).
  await page.addInitScript(
    ({ storeId, mainId, folderId }) => {
      type FixtureMap = Record<string, Record<string, unknown>[]>;
      const existing: FixtureMap =
        ((window as unknown as Record<string, unknown>).__E2E_FIXTURES__ as
          | FixtureMap
          | undefined) ?? {};
      (window as unknown as Record<string, unknown>).__E2E_FIXTURES__ = {
        ...existing,
        [`${mainId}/Stores`]: [
          {
            store_id: storeId,
            store_name: "E2E Test Store",
            drive_folder_id: folderId,
            owner_email: "owner@e2e.test",
            my_role: "owner",
            joined_at: new Date().toISOString(),
            deleted_at: null,
          },
        ],
      };
    },
    { storeId, mainId: E2E_MAIN_SPREADSHEET_ID, folderId: E2E_STORE_FOLDER_ID },
  );

  // Inject auth state to localStorage for subsequent navigations
  await page.addInitScript(
    ({ storeId, mainSpreadsheetId }) => {
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
            mainSpreadsheetId,
            activeStoreId: storeId,
          },
          version: 0,
        }),
      );
    },
    { storeId, mainSpreadsheetId: E2E_MAIN_SPREADSHEET_ID },
  );

  return {
    storeId,
    spreadsheetId: E2E_MAIN_SPREADSHEET_ID,
    mainSpreadsheetId: E2E_MAIN_SPREADSHEET_ID,
  };
}

/**
 * Constant E2E store config used as the MSW fixture namespace key.
 * All E2E tests share this spreadsheet identity — the MSW Drive handler
 * always returns "e2e-main-id" as the active spreadsheet ID.
 */
export const E2E_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
};

/**
 * Single entry-point for test setup. Always runs in this order:
 *   1. setMswFixtures  — injects window.__E2E_FIXTURES__ via addInitScript
 *   2. enableTestMode  — injects window.__E2E_SIGNIN__ / __MSW_ENABLED__ via addInitScript
 *   3. loginAndSetup   — navigates: /login → /setup → /cashier
 *
 * Both step 1 and 2 use addInitScript, so they must run before any navigation.
 * Step 3 performs the navigation, so fixtures are already in place when pages load.
 *
 * Pass an empty object (or omit `tables`) when no pre-seeded data is needed.
 */
export async function setup(
  page: Page,
  tables: FixtureTables = {},
): Promise<FlowResult> {
  await setMswFixtures(page, E2E_STORE, tables);
  await enableTestMode(page);
  return loginAndSetup(page);
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
