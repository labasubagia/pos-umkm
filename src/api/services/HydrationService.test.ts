import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { queryClient } from "../../hooks/queryClient";
import { clearDbCache, getDb } from "../adapters/dexie/db";
import { HydrationService } from "./HydrationService";

const TEST_STORE_ID = "hydration-store";

const mocks = vi.hoisted(() => ({
  getCurrentStoreMapStore: vi.fn(),
}));

vi.mock("../store/storeMapStore", () => ({
  getCurrentStoreMapStore: mocks.getCurrentStoreMapStore,
}));

describe("HydrationService", () => {
  beforeEach(async () => {
    queryClient.clear();
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
      isAuthenticated: true,
      activeStoreId: TEST_STORE_ID,
      mainSpreadsheetId: "main-sheet-id",
    });

    const db = getDb(TEST_STORE_ID);
    const mainDb = getDb("__main__");
    await Promise.all([
      ...db.tables.map((table) => table.clear()),
      ...mainDb.tables.map((table) => table.clear()),
    ]);

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
                "drive_folder_id",
                "owner_email",
                "my_role",
                "joined_at",
              ],
              [
                "store-a",
                "Toko A",
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

  it("hydrates the Stores table from mainSpreadsheetId into the global __main__ DB", async () => {
    const service = new HydrationService(
      () => "token",
      getDb(TEST_STORE_ID),
      getDb("__main__"),
    );

    await service.hydrateAll();

    // Stores data must land in the global __main__ DB, not the per-store DB.
    expect(await getDb("__main__").Stores.toArray()).toEqual([
      expect.objectContaining({
        id: "store-a",
        store_id: "store-a",
        store_name: "Toko A",
        drive_folder_id: "folder-a",
      }),
    ]);
    // Per-store DBs intentionally do not expose the `Stores` table; the
    // authoritative `Stores` table lives in the global `__main__` DB.
    expect(() => getDb(TEST_STORE_ID).table("Stores")).toThrow();
  });

  it("hydrates Stores into __main__ when optional date columns are empty strings", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/values/Stores")) {
        return new Response(
          JSON.stringify({
            values: [
              [
                "store_id",
                "store_name",
                "drive_folder_id",
                "owner_email",
                "my_role",
                "joined_at",
                "deleted_at",
              ],
              [
                "store-b",
                "Toko B",
                "folder-b",
                "owner@test.com",
                "owner",
                "",
                "",
              ],
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    });

    const service = new HydrationService(
      () => "token",
      getDb(TEST_STORE_ID),
      getDb("__main__"),
    );

    await service.hydrateAll();

    expect(await getDb("__main__").Stores.toArray()).toEqual([
      expect.objectContaining({
        id: "store-b",
        store_id: "store-b",
        store_name: "Toko B",
      }),
    ]);
  });
});
