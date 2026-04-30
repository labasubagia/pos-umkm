/**
 * T015 + T016 — setup.service unit tests
 *
 * Uses spies on adapters (getRepos, makeRepo, driveClient, storeFolderService)
 * so no Drive/Sheets API calls are made.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapters from "../../lib/adapters";
import { useAuthStore } from "../../store/authStore";
import {
  activateStore,
  createMainSpreadsheet,
  createMasterSpreadsheet,
  findOrCreateMain,
  getMainSpreadsheetId,
  initializeMasterSheets,
  initializeMonthlySheets,
  listStores,
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TABS,
  MONTHLY_TABS,
  runFirstTimeSetup,
  type StoreRecord,
  saveMainSpreadsheetId,
  shareSheetWithAllMembers,
  updateStoreName,
} from "./setup.service";

// jsdom localStorage.clear() may not exist in all vitest environments; use Map-backed mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: "test-id",
    sheetName: "mock",
    getAll: vi.fn().mockResolvedValue([]),
    // ISheetRepository methods — used by sharedMakeRepo (makeRepo() path)
    batchAppend: vi.fn().mockResolvedValue(undefined),
    batchUpdateCells: vi.fn().mockResolvedValue(undefined),
    // ILocalRepository methods — used by mockRepos (getRepos() path)
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    batchUpsert: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>;
let sharedMakeRepo: ReturnType<typeof mockRepo>;

// Mock the store map store
const mockSetStoreMap = vi.fn();
const mockGetSheetMeta = vi.fn();
let mockStoreMapState: Record<string, unknown> = {
  sheets: {},
  setStoreMap: mockSetStoreMap,
  getSheetMeta: mockGetSheetMeta,
};

vi.mock("../../store/storeMapStore", () => ({
  getCurrentStoreMapStore: vi.fn(() => ({
    getState: () => mockStoreMapState,
  })),
  getStoreMapStore: vi.fn(() => ({
    getState: () => mockStoreMapState,
  })),
}));

beforeEach(() => {
  localStorageMock.clear();
  // Reset Zustand auth store so mainSpreadsheetId don't leak between tests.
  useAuthStore.getState().clearAuth();
  vi.restoreAllMocks();

  mockRepos = {
    categories: mockRepo(),
    products: mockRepo(),
    variants: mockRepo(),
    members: mockRepo(),
    customers: mockRepo(),
    settings: mockRepo(),
    stockLog: mockRepo(),
    purchaseOrders: mockRepo(),
    purchaseOrderItems: mockRepo(),
    transactions: mockRepo(),
    transactionItems: mockRepo(),
    refunds: mockRepo(),
    stores: mockRepo(),
    monthlySheets: mockRepo(),
    auditLog: mockRepo(),
  };
  vi.spyOn(adapters, "getRepos").mockReturnValue(
    mockRepos as ReturnType<typeof adapters.getRepos>,
  );

  sharedMakeRepo = mockRepo();
  vi.spyOn(adapters, "makeRepo").mockReturnValue(
    sharedMakeRepo as ReturnType<typeof adapters.makeRepo>,
  );

  vi.spyOn(adapters.driveClient, "createSpreadsheet").mockResolvedValue(
    "new-sheet-id",
  );
  vi.spyOn(adapters.driveClient, "ensureFolder").mockResolvedValue("folder-id");
  vi.spyOn(adapters.driveClient, "shareSpreadsheet").mockResolvedValue(
    undefined,
  );

  // Mock storeFolderService.traverse to return a valid TraverseResult
  vi.spyOn(adapters.storeFolderService, "traverse").mockResolvedValue({
    sheets: {
      Stores: {
        spreadsheet_id: "main-id",
        spreadsheet_name: "main",
        folder_path: "",
        sheet_name: "Stores",
        sheet_id: 1,
        headers: ["store_id", "store_name"],
      },
      Settings: {
        spreadsheet_id: "master-id",
        spreadsheet_name: "master",
        folder_path: "",
        sheet_name: "Settings",
        sheet_id: 2,
        headers: ["id", "key", "value"],
      },
    },
    monthlySheets: [
      {
        yearMonth: "2026-04",
        sheets: {
          Transactions: {
            spreadsheet_id: "monthly-id",
            spreadsheet_name: "transaction_2026-04",
            folder_path: "transactions/2026",
            sheet_name: "Transactions",
            sheet_id: 3,
            headers: ["id", "created_at"],
          },
        },
      },
    ],
  });

  // Reset store map state
  mockStoreMapState = {
    sheets: {},
    monthlySheets: [],
    setStoreMap: mockSetStoreMap,
    getSheetMeta: mockGetSheetMeta,
    getCurrentMonthSheets: vi.fn().mockReturnValue(undefined),
  };
});

// ─── createMainSpreadsheet ────────────────────────────────────────────────────

describe("createMainSpreadsheet", () => {
  it("creates a spreadsheet named 'main' in apps/pos_umkm folder", async () => {
    await createMainSpreadsheet("owner@test.com");

    expect(adapters.driveClient.ensureFolder).toHaveBeenCalledWith([
      "apps",
      "pos_umkm",
    ]);
    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith(
      "main",
      "folder-id",
      [...MAIN_TABS],
    );
  });

  it("writes Stores header row after creation", async () => {
    await createMainSpreadsheet();
    expect(sharedMakeRepo.writeHeaders).toHaveBeenCalledWith(
      MAIN_TAB_HEADERS.Stores,
    );
  });

  it("returns the spreadsheet ID", async () => {
    const id = await createMainSpreadsheet();
    expect(id).toBe("new-sheet-id");
  });
});

// ─── listStores ───────────────────────────────────────────────────────────────

describe("listStores", () => {
  it("reads rows from main.Stores tab", async () => {
    sharedMakeRepo.getAll.mockResolvedValue([
      {
        store_id: "s1",
        store_name: "Toko A",
        master_spreadsheet_id: "m1",
        drive_folder_id: "f1",
        owner_email: "a@b.com",
        my_role: "owner",
        joined_at: "2026-01-01",
      },
    ]);

    const stores = await listStores("main-id");
    expect(stores).toHaveLength(1);
    expect(stores[0].store_id).toBe("s1");
    expect(stores[0].store_name).toBe("Toko A");
    expect(stores[0].master_spreadsheet_id).toBe("m1");
  });

  it("filters out rows without store_id or master_spreadsheet_id", async () => {
    sharedMakeRepo.getAll.mockResolvedValue([
      { store_id: "s1", master_spreadsheet_id: "m1" },
      { store_id: "", master_spreadsheet_id: "m2" },
      { store_id: "s3", master_spreadsheet_id: "" },
      {},
    ]);

    const stores = await listStores("main-id");
    expect(stores).toHaveLength(1);
  });
});

// ─── getMainSpreadsheetId / saveMainSpreadsheetId ────────────────────────────

describe("getMainSpreadsheetId", () => {
  it("returns null when not set", () => {
    expect(getMainSpreadsheetId()).toBeNull();
  });

  it("returns value from authStore when set", () => {
    saveMainSpreadsheetId("main-123");
    expect(getMainSpreadsheetId()).toBe("main-123");
  });

  it("falls back to legacy localStorage key", () => {
    localStorage.setItem("mainSpreadsheetId", "legacy-main");
    expect(getMainSpreadsheetId()).toBe("legacy-main");
  });
});

// ─── saveMainSpreadsheetId ────────────────────────────────────────────────────

describe("saveMainSpreadsheetId", () => {
  it("persists to authStore and legacy localStorage key", () => {
    saveMainSpreadsheetId("my-main-id");
    expect(useAuthStore.getState().mainSpreadsheetId).toBe("my-main-id");
    expect(localStorage.getItem("mainSpreadsheetId")).toBe("my-main-id");
  });
});

// ─── findOrCreateMain ─────────────────────────────────────────────────────────

describe("findOrCreateMain", () => {
  it("creates main spreadsheet when not cached", async () => {
    const result = await findOrCreateMain("owner@test.com");
    expect(result.mainSpreadsheetId).toBe("new-sheet-id");
    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith(
      "main",
      expect.anything(),
      expect.anything(),
    );
  });

  it("uses cached mainSpreadsheetId when available", async () => {
    saveMainSpreadsheetId("cached-main");
    sharedMakeRepo.getAll.mockResolvedValue([]);

    const result = await findOrCreateMain();
    expect(result.mainSpreadsheetId).toBe("cached-main");
    // Should NOT call createSpreadsheet for main
    expect(adapters.driveClient.createSpreadsheet).not.toHaveBeenCalled();
  });

  it("returns the store list from main.Stores", async () => {
    sharedMakeRepo.getAll.mockResolvedValue([
      { store_id: "s1", store_name: "Toko A", master_spreadsheet_id: "m1" },
    ]);

    const result = await findOrCreateMain();
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].store_name).toBe("Toko A");
  });
});

// ─── createMasterSpreadsheet ──────────────────────────────────────────────────

describe("createMasterSpreadsheet", () => {
  it("creates store folder, master spreadsheet, and registers in main.Stores", async () => {
    const result = await createMasterSpreadsheet(
      "Toko Baru",
      "owner@test.com",
      "main-id",
    );

    expect(adapters.driveClient.ensureFolder).toHaveBeenCalledWith([
      "apps",
      "pos_umkm",
      "stores",
      expect.any(String),
    ]);
    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith(
      "master",
      "folder-id",
      [...MASTER_TABS],
    );
    expect(sharedMakeRepo.batchAppend).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          store_name: "Toko Baru",
          master_spreadsheet_id: "new-sheet-id",
          owner_email: "owner@test.com",
          my_role: "owner",
        }),
      ]),
    );
    expect(result.masterId).toBe("new-sheet-id");
    expect(result.storeId).toBeTruthy();
    expect(result.driveFolderId).toBe("folder-id");
  });
});

// ─── initializeMasterSheets ───────────────────────────────────────────────────

describe("initializeMasterSheets", () => {
  it("writes headers to every master tab", async () => {
    await initializeMasterSheets("master-id");
    expect(sharedMakeRepo.writeHeaders).toHaveBeenCalledTimes(
      MASTER_TABS.length,
    );
  });

  it("throws when spreadsheetId is empty", async () => {
    await expect(initializeMasterSheets("")).rejects.toThrow(
      "initializeMasterSheets: spreadsheetId is required",
    );
  });
});

// ─── initializeMonthlySheets ──────────────────────────────────────────────────

describe("initializeMonthlySheets", () => {
  it("writes headers to every monthly tab", async () => {
    await initializeMonthlySheets("monthly-id");
    expect(sharedMakeRepo.writeHeaders).toHaveBeenCalledTimes(
      MONTHLY_TABS.length,
    );
  });
});

// ─── activateStore ────────────────────────────────────────────────────────────

describe("activateStore", () => {
  const store: StoreRecord = {
    store_id: "store-abc",
    store_name: "Toko ABC",
    master_spreadsheet_id: "master-id",
    drive_folder_id: "folder-id",
    owner_email: "owner@test.com",
    my_role: "owner",
    joined_at: "2026-01-01",
  };

  it("throws when drive_folder_id is empty", async () => {
    const storeNoFolder = { ...store, drive_folder_id: "" };
    await expect(activateStore(storeNoFolder)).rejects.toThrow(
      "has no drive_folder_id",
    );
  });

  it("does not persist activeStoreId or storeFolderId to localStorage", async () => {
    await activateStore(store);
    expect(localStorage.getItem("activeStoreId")).toBeNull();
    expect(localStorage.getItem("storeFolderId")).toBeNull();
  });

  it("traverses the store folder", async () => {
    await activateStore(store);
    expect(adapters.storeFolderService.traverse).toHaveBeenCalledWith(
      "folder-id",
    );
  });

  it("sets the store map", async () => {
    await activateStore(store);
    expect(mockSetStoreMap).toHaveBeenCalledWith(
      "folder-id",
      expect.any(Object),
      expect.any(Array),
    );
  });
});

// ─── updateStoreName ──────────────────────────────────────────────────────────

describe("updateStoreName", () => {
  it("updates store_name in main.Stores", async () => {
    saveMainSpreadsheetId("main-id");
    await updateStoreName("store-1", "Nama Baru");
    expect(sharedMakeRepo.batchUpdateCells).toHaveBeenCalledWith([
      { rowId: "store-1", column: "store_name", value: "Nama Baru" },
    ]);
  });

  it("throws when mainSpreadsheetId is not set", async () => {
    await expect(updateStoreName("s1", "X")).rejects.toThrow(
      "mainSpreadsheetId not found",
    );
  });
});

// ─── shareSheetWithAllMembers ─────────────────────────────────────────────────

describe("shareSheetWithAllMembers", () => {
  it("shares with all active members", async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: "m1", email: "a@test.com" },
      { id: "m2", email: "b@test.com" },
      { id: "m3", email: "deleted@test.com", deleted_at: "2026-01-01" },
    ]);

    await shareSheetWithAllMembers("sheet-id");

    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledTimes(2);
    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledWith(
      "sheet-id",
      "a@test.com",
      "editor",
    );
    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledWith(
      "sheet-id",
      "b@test.com",
      "editor",
    );
  });
});

// ─── runFirstTimeSetup ────────────────────────────────────────────────────────

describe("runFirstTimeSetup", () => {
  it("creates main, master, and monthly spreadsheets", async () => {
    const createSpy = vi
      .spyOn(adapters.driveClient, "createSpreadsheet")
      .mockResolvedValueOnce("main-id")
      .mockResolvedValueOnce("master-id")
      .mockResolvedValueOnce("monthly-id")
      .mockResolvedValueOnce("next-monthly-id");

    await runFirstTimeSetup("Toko Santoso");

    expect(createSpy).toHaveBeenNthCalledWith(
      1,
      "main",
      expect.anything(),
      expect.anything(),
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      "master",
      expect.anything(),
      expect.anything(),
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/^transaction_/),
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns storeId and driveFolderId", async () => {
    vi.spyOn(adapters.driveClient, "createSpreadsheet")
      .mockResolvedValueOnce("main-id")
      .mockResolvedValueOnce("master-id")
      .mockResolvedValueOnce("monthly-id")
      .mockResolvedValueOnce("next-monthly-id");

    const result = await runFirstTimeSetup("Toko Santoso", "owner@example.com");
    expect(result.storeId).toBeTruthy();
    expect(result.driveFolderId).toBe("folder-id");
  });

  it("saves mainSpreadsheetId to localStorage", async () => {
    vi.spyOn(adapters.driveClient, "createSpreadsheet")
      .mockResolvedValueOnce("main-id")
      .mockResolvedValueOnce("master-id")
      .mockResolvedValueOnce("monthly-id")
      .mockResolvedValueOnce("next-monthly-id");

    await runFirstTimeSetup("Toko Santoso");
    expect(localStorage.getItem("mainSpreadsheetId")).toBe("main-id");
  });
});
