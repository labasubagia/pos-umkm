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
 * Constant E2E store config used as the MSW fixture namespace key.
 * All E2E tests share this spreadsheet identity — the MSW Drive handler
 * always returns "e2e-main-id" as the active spreadsheet ID.
 */
export const E2E_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
};

// The main spreadsheet ID is always "e2e-main-id" in E2E tests — the MSW
// Drive handler returns this ID from its getActiveSpreadsheetId() default.
const E2E_MAIN_SPREADSHEET_ID = "e2e-main-id";
// The store folder ID is always "new-e2e-id" — MSW returns this from every
// POST /drive/v3/files call during store folder creation.
const E2E_STORE_FOLDER_ID = "new-e2e-id";

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
 * 3. Redirect to /stores (stores exist) or /setup (no stores)
 * 4a. /stores — click the first store entry to enter it
 * 4b. /setup  — fill the setup form to create a store
 * 5. Wait for redirect to cashier
 *
 * Returns the storeId and spreadsheet IDs created during setup.
 *
 * NOTE: Does NOT inject any Stores fixture. Use setup() which injects the
 * correct Stores fixture based on whether the caller pre-seeded Stores or not.
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

  // After sign-in the app always routes through /stores first:
  //   - stores exist  → stays on /stores (store picker renders)
  //   - no stores     → immediately redirects to /setup
  // We wait for the first URL to match, then race to find the stable state.
  await page.waitForURL(/\/(setup|stores)(\/|$)/, { timeout: 15000 });

  if (page.url().includes("/stores")) {
    // App landed on /stores — may stay (stores exist) or redirect to /setup.
    // Race: whichever happens first wins.
    await Promise.race([
      page
        .locator('[data-testid^="btn-store-"]')
        .first()
        .waitFor({ timeout: 5000 }),
      page.waitForURL("**/setup", { timeout: 5000 }),
    ]).catch(() => {});
  }

  if (page.url().includes("/setup")) {
    // No stores existed: fill the setup form to create one.
    const businessNameInput = page.getByLabel(/Nama Usaha/i);
    await businessNameInput.waitFor({ state: "visible" });
    await businessNameInput.fill("E2E Test Store");
    await page.getByRole("button", { name: /Mulai Sekarang/i }).click();
  } else {
    // Stores existed: store picker is rendered — click the first entry.
    await page.locator('[data-testid^="btn-store-"]').first().click();
  }

  // Wait for redirect to cashier
  await page.waitForURL("**/cashier", { timeout: 20000 });

  // Extract storeId from URL: /pos-umkm/{storeId}/cashier
  const url = page.url();
  const match = url.match(/\/pos-umkm\/([^/]+)\/cashier/);
  const storeId = match?.[1] ?? "unknown";

  // Inject auth state to localStorage for subsequent navigations
  await page.addInitScript(
    ({
      storeId,
      mainSpreadsheetId,
    }: {
      storeId: string;
      mainSpreadsheetId: string;
    }) => {
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
 * Single entry-point for test setup. Always runs in this order:
 *   1. setMswFixtures  — injects window.__E2E_FIXTURES__ via addInitScript
 *   2. enableTestMode  — injects window.__E2E_SIGNIN__ / __MSW_ENABLED__ via addInitScript
 *   3. loginAndSetup   — navigates: /login → /stores|setup → /cashier
 *   4. Stores fixture  — if tables.Stores was NOT provided, injects the default
 *                        single-store entry so ensureStoreMapReady() can resolve
 *                        drive_folder_id on subsequent navigations.
 *                        If tables.Stores WAS provided, those rows are already in
 *                        the fixture map from step 1 — no extra entry is injected.
 *
 * Pass an empty object (or omit `tables`) when no pre-seeded data is needed.
 */
export async function setup(
  page: Page,
  tables: FixtureTables = {},
): Promise<FlowResult> {
  await setMswFixtures(page, E2E_STORE, tables);
  await enableTestMode(page);
  const result = await loginAndSetup(page);

  if (!tables.Stores) {
    // No Stores were pre-seeded: inject the default single-store entry so
    // ensureStoreMapReady() can look up drive_folder_id on subsequent reloads.
    await page.addInitScript(
      ({
        storeId,
        mainId,
        folderId,
      }: {
        storeId: string;
        mainId: string;
        folderId: string;
      }) => {
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
      {
        storeId: result.storeId,
        mainId: E2E_MAIN_SPREADSHEET_ID,
        folderId: E2E_STORE_FOLDER_ID,
      },
    );
  }
  // When tables.Stores is provided, setMswFixtures already injected those rows
  // via addInitScript in step 1. No extra entry needed — "E2E Test Store" must
  // not be added on top of the caller's explicit store list.

  return result;
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
