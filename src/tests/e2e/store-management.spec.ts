/**
 * E2E specs for Store Management (T061).
 *
 * Auth is injected via localStorage. Store data is seeded into Dexie.
 * Google Drive/Sheets API calls (createSpreadsheet for new stores) are
 * stubbed via page.route() to return a fake spreadsheetId.
 */
import { expect, test } from "@playwright/test";
import { BASE, DEFAULT_STORE, injectAuthState } from "./helpers/auth";
import { seedDexie } from "./helpers/dexie-seed";
import { setMswFixtures } from "./helpers/msw-state";

const STORE = DEFAULT_STORE;

const SEED_STORES = [
  {
    id: "store-a",
    store_id: "store-a",
    store_name: "Toko Utama",
    master_spreadsheet_id: "master-a",
    drive_folder_id: "folder-a",
    owner_email: "owner@e2e.test",
    my_role: "owner",
    joined_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  },
  {
    id: "store-b",
    store_id: "store-b",
    store_name: "Toko Mitra",
    master_spreadsheet_id: "master-b",
    drive_folder_id: "folder-b",
    owner_email: "other@test.com",
    my_role: "manager",
    joined_at: "2026-02-01T00:00:00Z",
    deleted_at: null,
  },
];

async function signInToSettings(page: Parameters<typeof injectAuthState>[0]) {
  // Stores live in the global __main__ DB; they are keyed by mainSpreadsheetId.
  // setMswFixtures maps Stores → mainSpreadsheetId so HydrationService
  // hydrates them into __main__ naturally.
  await setMswFixtures(page, STORE, { Stores: SEED_STORES });
  await injectAuthState(page, STORE);
  await page.goto(`${BASE}/${STORE.storeId}/settings/store-management`);
  await page.getByTestId("btn-add-store").waitFor();

  await page.getByRole("heading", { name: /kelola toko/i }).waitFor();
}

test.describe("Store Management", () => {
  test("owner can add a new store", async ({ page }) => {
    await signInToSettings(page);

    // Drive and Sheets API calls are handled by the MSW service worker
    // (driveHandlers in src/mocks/handlers/drive.ts). No page.route() stubs needed.
    await page.getByTestId("btn-add-store").click();
    await page.getByTestId("input-store-name").fill("Cabang Baru");
    await page.getByTestId("btn-save-store").click();

    // Use role=cell to avoid strict-mode ambiguity with the navbar store switcher option.
    await expect(page.getByRole("cell", { name: "Cabang Baru" })).toBeVisible();
  });

  test("owner can edit store name", async ({ page }) => {
    await signInToSettings(page);

    await page.getByTestId("btn-edit-store-store-a").click();
    const input = page.getByTestId("input-store-name-edit");
    await input.clear();
    await input.fill("Toko Utama Renamed");
    await page.getByTestId("btn-save-store-edit").click();

    // Use role=cell to avoid strict-mode ambiguity with the navbar store switcher option.
    await expect(
      page.getByRole("cell", { name: "Toko Utama Renamed" }),
    ).toBeVisible();
  });

  test("owner can delete owned store", async ({ page }) => {
    await signInToSettings(page);

    // Use role=cell to avoid strict-mode ambiguity with the navbar store switcher option.
    await expect(page.getByRole("cell", { name: "Toko Utama" })).toBeVisible();
    await page.getByTestId("btn-delete-store-store-a").click();
    await page.getByTestId("btn-confirm-delete-store").click();
    await expect(
      page.getByRole("cell", { name: "Toko Utama" }),
    ).not.toBeVisible();
  });

  test("member can leave a non-owned store", async ({ page }) => {
    const now = new Date().toISOString();
    const storeMembers = [
      {
        id: "m1",
        email: "owner@e2e.test",
        name: "E2E Owner",
        role: "manager",
        invited_at: "2026-02-01T00:00:00Z",
        deleted_at: null,
        created_at: now,
      },
    ];

    // Stores keyed under the main spreadsheet (DEFAULT_STORE.mainSpreadsheetId).
    await setMswFixtures(page, STORE, { Stores: SEED_STORES });
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/settings/store-management`);
    await page.getByTestId("btn-add-store").waitFor();

    // Members for store-b live in store-b's Dexie DB, which is never hydrated
    // (HydrationService only runs for the active store). Seeding after page
    // load is race-free because hydration won't clear store-b's tables.
    await seedDexie(page, "store-b", { Members: storeMembers });

    await page.getByRole("heading", { name: /kelola toko/i }).waitFor();

    await page.getByTestId("btn-leave-store-store-b").click();
    await page.getByTestId("btn-confirm-leave-store").click();
    await page.waitForURL(/\/stores/, { waitUntil: "commit" });
  });

  test("Save button is disabled when store name is empty", async ({ page }) => {
    await signInToSettings(page);

    await page.getByTestId("btn-add-store").click();
    // Leave input empty
    const saveBtn = page.getByTestId("btn-save-store");
    await expect(saveBtn).toBeDisabled();
  });
});
