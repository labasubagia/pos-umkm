/**
 * E2E specs for Store Management (T061).
 *
 * Auth is injected via localStorage. Store data is seeded into Dexie.
 * Google Drive/Sheets API calls (createSpreadsheet for new stores) are
 * stubbed via page.route() to return a fake spreadsheetId.
 */
import { expect, test } from "@playwright/test";
import { navigateTo } from "./helpers/auth";
import { BASE, DEFAULT_STORE, injectAuthState } from "./helpers/auth-dexie";
import {
  reloadAndWait,
  seedDexie,
  waitForHydration,
} from "./helpers/dexie-seed";

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

async function _openStoresTab(page: Parameters<typeof injectAuthState>[0]) {
  await navigateTo(page, `${BASE}/${STORE.storeId}/settings`);

  await page.getByRole("heading", { name: /kelola toko/i }).waitFor();
}

async function signInToSettings(page: Parameters<typeof injectAuthState>[0]) {
  await injectAuthState(page, STORE);
  await page.goto(`${BASE}/${STORE.storeId}/settings/store-management`);
  await page.getByTestId("btn-add-store").waitFor();
  await waitForHydration(page);
  await seedDexie(page, STORE.storeId, { Stores: SEED_STORES });
  await reloadAndWait(page, "btn-add-store");

  await page.getByRole("heading", { name: /kelola toko/i }).waitFor();
}

test.describe("Store Management", () => {
  test("owner can add a new store", async ({ page }) => {
    await signInToSettings(page);

    // Register specific API stubs that override the general googleapis.com catch-all
    // registered by stubGoogleApis(). We use page.unroute() first to ensure clean
    // precedence, then register the more specific routes.
    await page.unroute("**googleapis.com/drive/v3/files**");
    await page.unroute("**googleapis.com/v4/spreadsheets**");

    // Drive stub distinguishes GET (search → empty files list) from POST/PATCH (create/move → id).
    await page.route("**googleapis.com/drive/v3/files**", (route) => {
      const req = route.request();
      if (req.method() === "GET" && req.url().includes("?fields=parents")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ parents: ["root"] }),
        });
      } else if (req.method() === "GET") {
        // Search query — return no existing items so createStore always creates fresh.
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ files: [] }),
        });
      } else {
        // POST create folder / PATCH move
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "new-folder-id" }),
        });
      }
    });
    await page.route("**googleapis.com/v4/spreadsheets**", (route) => {
      const req = route.request();
      if (req.method() === "POST" && /\/v4\/spreadsheets$/.test(req.url())) {
        // Create spreadsheet
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            spreadsheetId: "new-sheet-id",
            properties: { title: "Cabang Baru" },
          }),
        });
      } else {
        // batchUpdate, values.append, values.get, etc.
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      }
    });
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

    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/settings/store-management`);
    await page.getByTestId("btn-add-store").waitFor();
    await waitForHydration(page);
    // Seed Stores in the active store's DB, and Members in store-b's DB
    // (removeAccessToStore uses getMembersForStore which opens the target store's DB)
    await seedDexie(page, STORE.storeId, { Stores: SEED_STORES });
    await seedDexie(page, "store-b", { Members: storeMembers });
    await reloadAndWait(page, "btn-add-store");

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
