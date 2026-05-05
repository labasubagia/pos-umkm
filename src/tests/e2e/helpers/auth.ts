/**
 * auth.ts — E2E auth helpers.
 *
 * Includes navigation utilities, test-mode setup, and the full login flow.
 *
 * Usage (preferred — single entry point):
 *   const { storeId } = await setup(page, { Products: [...], Categories: [...] });
 *   // Now at cashier with products already in MSW fixtures
 *
 * setup() always runs: setMswFixtures → enableTestMode → loginAndSetup
 * Pass an empty object (or omit) when no pre-seeded fixtures are needed.
 */
import type { Page } from "@playwright/test";
import { type FixtureTables, setMswFixtures } from "./msw-state";

export const BASE = "/pos-umkm";

export interface StoreConfig {
  storeId: string;
  mainSpreadsheetId: string;
  folderId: string;
}

/**
 * Default E2E store config — used as a stable fallback and as the type template.
 * setup() generates a unique config per test via makeStoreConfig().
 */
export const E2E_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
  folderId: "new-e2e-id",
};

/**
 * Generate a unique StoreConfig for a single test run.
 * Uses a short random suffix to avoid any cross-test fixture collisions.
 */
function makeStoreConfig(): StoreConfig {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    storeId: `e2e-store-${suffix}`,
    mainSpreadsheetId: `e2e-main-${suffix}`,
    folderId: `e2e-folder-${suffix}`,
  };
}

/**
 * Enable test mode flags before navigation.
 * Must be called before page.goto().
 */
export async function enableTestMode(
  page: Page,
  folderId: string,
): Promise<void> {
  await page.addInitScript(
    ({ folderId }: { folderId: string }) => {
      (window as unknown as Record<string, unknown>).__E2E_SIGNIN__ = true;
      (window as unknown as Record<string, unknown>).__MSW_ENABLED__ = true;
      (window as unknown as Record<string, unknown>).__E2E_FOLDER_ID__ =
        folderId;
    },
    { folderId },
  );
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
export async function login(
  page: Page,
  mainSpreadsheetId: string,
): Promise<StoreConfig> {
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
    { storeId, mainSpreadsheetId },
  );

  return {
    storeId,
    mainSpreadsheetId,
    folderId: E2E_STORE.folderId,
  };
}

/**
 * Single entry-point for test setup. Always runs in this order:
 *   1. setMswFixtures  — injects window.__E2E_FIXTURES__ via addInitScript
 *   2. enableTestMode  — injects window.__E2E_SIGNIN__ / __MSW_ENABLED__ via addInitScript
 *   3. login   — navigates: /login → /stores|setup → /cashier
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
): Promise<StoreConfig> {
  const store = makeStoreConfig();
  await setMswFixtures(page, store, tables);
  await enableTestMode(page, store.folderId);
  const result = await login(page, store.mainSpreadsheetId);
  // Merge the actual storeId extracted from the URL (may differ from store.storeId
  // when stores are pre-seeded and the first store is clicked instead of created).
  const finalConfig: StoreConfig = { ...store, storeId: result.storeId };

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
        storeId: finalConfig.storeId,
        mainId: finalConfig.mainSpreadsheetId,
        folderId: finalConfig.folderId,
      },
    );
  }
  // When tables.Stores is provided, setMswFixtures already injected those rows
  // via addInitScript in step 1. No extra entry needed — "E2E Test Store" must
  // not be added on top of the caller's explicit store list.

  return finalConfig;
}
