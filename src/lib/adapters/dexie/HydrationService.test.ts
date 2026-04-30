import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { clearDbCache, getDb } from "./db";
import { HydrationService } from "./HydrationService";

const TEST_STORE_ID = "hydration-store";

const mocks = vi.hoisted(() => ({
  getCurrentStoreMapStore: vi.fn(),
}));

vi.mock("../../../store/storeMapStore", () => ({
  getCurrentStoreMapStore: mocks.getCurrentStoreMapStore,
}));

describe("HydrationService", () => {
  beforeEach(async () => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
    useAuthStore.setState({
      user: {
        id: "owner-1",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
      },
      role: "owner",
      accessToken: "token",
      isAuthenticated: true,
      activeStoreId: TEST_STORE_ID,
      mainSpreadsheetId: "main-sheet-id",
    });

    const db = getDb(TEST_STORE_ID);
    await Promise.all(db.tables.map((table) => table.clear()));

    mocks.getCurrentStoreMapStore.mockReturnValue({
      getState: () => ({
        sheets: {},
        monthlySheets: [],
        getCurrentMonthSheets: () => undefined,
      }),
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/values/Stores")) {
        return new Response(
          JSON.stringify({
            values: [
              [
                "store_id",
                "store_name",
                "master_spreadsheet_id",
                "drive_folder_id",
                "owner_email",
                "my_role",
                "joined_at",
              ],
              [
                "store-a",
                "Toko A",
                "master-a",
                "folder-a",
                "owner@test.com",
                "owner",
                "2026-01-01T00:00:00Z",
              ],
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearDbCache();
    useAuthStore.getState().clearAuth();
  });

  it("hydrates the Stores table from mainSpreadsheetId into the active store DB", async () => {
    const service = new HydrationService(() => "token", getDb(TEST_STORE_ID));

    await service.hydrateAll();

    expect(await getDb(TEST_STORE_ID).Stores.toArray()).toEqual([
      expect.objectContaining({
        id: "store-a",
        store_id: "store-a",
        store_name: "Toko A",
        drive_folder_id: "folder-a",
      }),
    ]);
  });
});
