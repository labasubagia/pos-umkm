/**
 * E2E specs for Store Management (T061).
 *
 * Auth is injected via localStorage. Store data is seeded into Dexie.
 * Google Drive/Sheets API calls (createSpreadsheet for new stores) are
 * stubbed via page.route() to return a fake spreadsheetId.
 */
import { expect, test } from "@playwright/test";
import { BASE } from "./helpers/auth";
import { enableTestMode, loginAndSetup } from "./helpers/auth-flow";
import { setMswFixtures } from "./helpers/msw-state";

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

async function signInToSettings(page: Parameters<typeof enableTestMode>[0]) {
  await enableTestMode(page);
  const { storeId, mainSpreadsheetId } = await loginAndSetup(page);

  await setMswFixtures(
    page,
    { storeId, mainSpreadsheetId },
    { Stores: SEED_STORES },
  );

  await page.goto(`${BASE}/${storeId}/settings/store-management`);
  await page.waitForLoadState("domcontentloaded");
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

  test("Save button is disabled when store name is empty", async ({ page }) => {
    await signInToSettings(page);

    await page.getByTestId("btn-add-store").click();
    // Leave input empty
    const saveBtn = page.getByTestId("btn-save-store");
    await expect(saveBtn).toBeDisabled();
  });
});
