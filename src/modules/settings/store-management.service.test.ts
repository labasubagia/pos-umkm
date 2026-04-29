/**
 * Unit tests for store-management.service.ts
 *
 * All external I/O is mocked:
 *   - getRepos()         → in-memory stub (stores, members repos)
 *   - localCachePut      → vi.fn() no-op
 *   - getMembersForStore → in-memory stub
 *   - createMasterSpreadsheet / initializeMasterSheets → vi.fn()
 *   - useAuthStore → preset state
 *
 * Tests validate the orchestration logic in each service function;
 * lower-level repo / Dexie behaviour is tested elsewhere.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapters from "../../lib/adapters";
import { useAuthStore } from "../../store/authStore";
import type { StoreRecord } from "../auth/setup.service";
import * as setupService from "../auth/setup.service";
import {
  createStore,
  listStores,
  removeAccessToStore,
  removeOwnedStore,
  StoreManagementError,
  updateStore,
} from "./store-management.service";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MAIN_ID = "main-spreadsheet-id";
const MASTER_ID_A = "master-a";
const MASTER_ID_B = "master-b";

const storeA: StoreRecord = {
  store_id: "store-a",
  store_name: "Toko A",
  master_spreadsheet_id: MASTER_ID_A,
  drive_folder_id: "folder-a",
  owner_email: "owner@test.com",
  my_role: "owner",
  joined_at: "2026-01-01T00:00:00Z",
};

const storeB: StoreRecord = {
  store_id: "store-b",
  store_name: "Toko B",
  master_spreadsheet_id: MASTER_ID_B,
  drive_folder_id: "folder-b",
  owner_email: "other@test.com",
  my_role: "manager",
  joined_at: "2026-02-01T00:00:00Z",
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeRepoStub(rows: Record<string, unknown>[] = []) {
  return {
    getAll: vi.fn().mockResolvedValue(rows),
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    batchUpsert: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Preset auth store: logged-in owner with mainSpreadsheetId
  vi.spyOn(useAuthStore, "getState").mockReturnValue({
    ...useAuthStore.getState(),
    user: {
      id: "u1",
      email: "owner@test.com",
      name: "Test Owner",
      role: "owner",
    },
    mainSpreadsheetId: MAIN_ID,
  } as ReturnType<typeof useAuthStore.getState>);
  vi.spyOn(setupService, "getMainSpreadsheetId").mockReturnValue(MAIN_ID);
  // localCachePut is a no-op in unit tests
  vi.spyOn(adapters, "localCachePut").mockResolvedValue(undefined);
});

// ─── listStores ───────────────────────────────────────────────────────────────

describe("listStores", () => {
  it("returns all non-deleted stores", async () => {
    const storesRepo = makeRepoStub([storeA, storeB] as unknown as Record<
      string,
      unknown
    >[]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    const result = await listStores();

    expect(storesRepo.getAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      store_id: "store-a",
      store_name: "Toko A",
    });
    expect(result[1]).toMatchObject({
      store_id: "store-b",
      store_name: "Toko B",
    });
  });

  it("excludes rows with deleted_at set (already filtered by getAll via DexieSheetRepository)", async () => {
    // getAll() in DexieSheetRepository filters deleted rows — the service tests that it
    // calls getAll() and maps the returned rows. Rows with deleted_at are not returned by getAll.
    const storesRepo = makeRepoStub([storeA] as unknown as Record<
      string,
      unknown
    >[]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    const result = await listStores();

    expect(result).toHaveLength(1);
    expect(result[0].store_id).toBe("store-a");
  });

  it("throws StoreManagementError when mainSpreadsheetId is not set", async () => {
    vi.spyOn(setupService, "getMainSpreadsheetId").mockReturnValue(null);

    await expect(listStores()).rejects.toThrow(StoreManagementError);
  });
});

// ─── createStore ──────────────────────────────────────────────────────────────

describe("createStore", () => {
  it("provisions a new store and returns the record with the generated storeId", async () => {
    const newMasterId = "master-new";
    const newStoreId = "store-new";
    vi.spyOn(setupService, "createMasterSpreadsheet").mockResolvedValue({
      masterId: newMasterId,
      storeId: newStoreId,
      driveFolderId: "folder-new",
    });
    vi.spyOn(setupService, "initializeMasterSheets").mockResolvedValue(
      undefined,
    );

    const result = await createStore("Toko Baru");

    expect(setupService.createMasterSpreadsheet).toHaveBeenCalledWith(
      "Toko Baru",
      "owner@test.com",
      MAIN_ID,
    );
    expect(setupService.initializeMasterSheets).toHaveBeenCalledWith(
      newMasterId,
    );
    expect(adapters.localCachePut).toHaveBeenCalledWith("Stores", [
      expect.objectContaining({ id: newStoreId, store_id: newStoreId }),
    ]);
    expect(result).toMatchObject({
      store_name: "Toko Baru",
      master_spreadsheet_id: newMasterId,
      store_id: newStoreId,
    });
  });

  it("propagates error when createMasterSpreadsheet fails", async () => {
    vi.spyOn(setupService, "createMasterSpreadsheet").mockRejectedValue(
      new Error("Drive API error"),
    );
    vi.spyOn(setupService, "initializeMasterSheets").mockResolvedValue(
      undefined,
    );

    await expect(createStore("Toko Gagal")).rejects.toThrow("Drive API error");
  });
});

// ─── updateStore ──────────────────────────────────────────────────────────────

describe("updateStore", () => {
  it("calls batchUpdateCells with the patched store_name", async () => {
    const storesRepo = makeRepoStub();
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    await updateStore("store-a", { store_name: "Toko A Baru" });

    expect(storesRepo.batchUpdate).toHaveBeenCalledWith([
      { id: "store-a", store_name: "Toko A Baru" },
    ]);
  });

  it("does nothing when patch is empty or store_name is blank", async () => {
    const storesRepo = makeRepoStub();
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    await updateStore("store-a", { store_name: "  " });

    expect(storesRepo.batchUpdate).not.toHaveBeenCalled();
  });
});

// ─── removeOwnedStore ─────────────────────────────────────────────────────────

describe("removeOwnedStore", () => {
  it("soft-deletes the matching store row in the Stores tab", async () => {
    const storesRepo = makeRepoStub([storeA] as unknown as Record<
      string,
      unknown
    >[]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    await removeOwnedStore("store-a");

    expect(storesRepo.batchUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "store-a",
          deleted_at: expect.any(String),
        }),
      ]),
    );
  });

  it("throws StoreManagementError if storeId does not exist", async () => {
    const storesRepo = makeRepoStub([]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);

    await expect(removeOwnedStore("nonexistent")).rejects.toThrow(
      StoreManagementError,
    );
  });
});

// ─── removeAccessToStore ──────────────────────────────────────────────────────

describe("removeAccessToStore", () => {
  it("soft-deletes the caller's row in the target store's Members tab", async () => {
    const storesRepo = makeRepoStub([storeB] as unknown as Record<
      string,
      unknown
    >[]);
    const membersRepo = makeRepoStub([
      {
        id: "m1",
        email: "owner@test.com",
        role: "manager",
        invited_at: "",
        deleted_at: null,
      },
    ]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);
    vi.spyOn(adapters, "getMembersForStore").mockReturnValue(
      membersRepo as unknown as ReturnType<typeof adapters.getMembersForStore>,
    );

    await removeAccessToStore(MASTER_ID_B);

    expect(adapters.getMembersForStore).toHaveBeenCalledWith("store-b");
    expect(membersRepo.softDelete).toHaveBeenCalledWith("m1");
  });

  it("throws StoreManagementError if caller is not a member of the store", async () => {
    const storesRepo = makeRepoStub([storeB] as unknown as Record<
      string,
      unknown
    >[]);
    const membersRepo = makeRepoStub([
      {
        id: "m99",
        email: "someone-else@test.com",
        role: "cashier",
        invited_at: "",
        deleted_at: null,
      },
    ]);
    vi.spyOn(adapters, "getRepos").mockReturnValue({
      stores: storesRepo,
    } as unknown as ReturnType<typeof adapters.getRepos>);
    vi.spyOn(adapters, "getMembersForStore").mockReturnValue(
      membersRepo as unknown as ReturnType<typeof adapters.getMembersForStore>,
    );

    await expect(removeAccessToStore(MASTER_ID_B)).rejects.toThrow(
      StoreManagementError,
    );
  });
});
