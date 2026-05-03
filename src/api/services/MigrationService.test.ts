/**
 * MigrationService.test.ts — Tests for MigrationService
 *
 * Tests assert full result objects for clear visibility.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MigrationPayload } from "../../config/types";

const mockMakeRepo = vi.fn();
const mockStoreFolderService = {
  ensureFolder: vi.fn().mockResolvedValue("folder-id-123"),
  createSpreadsheet: vi.fn().mockResolvedValue("spreadsheet-id-456"),
};

vi.mock("../adapters", () => ({
  makeRepo: mockMakeRepo,
  storeFolderService: mockStoreFolderService,
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ mainSpreadsheetId: "main-123" }),
  },
}));

vi.mock("../../store/storeMapStore", () => ({
  getStoreMapStore: vi.fn().mockReturnValue({
    getState: vi.fn().mockReturnValue({
      lastTraversedAt: null,
      sheets: {},
      monthlySheets: [],
    }),
  }),
  getCurrentStoreMapStore: vi.fn().mockReturnValue({
    getState: vi.fn().mockReturnValue({
      sheets: {},
    }),
  }),
}));

// Prevent circular-dependency activation during test imports
vi.mock("./StoreActivationService", () => ({
  StoreActivationService: {
    activateStore: vi.fn().mockResolvedValue(undefined),
  },
  pendingActivations: new Map(),
  STORE_MAP_TTL_MS: 5 * 60 * 1000,
}));

vi.mock("./StoreRegistryService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./StoreRegistryService")>();
  return { ...actual };
});

describe("MigrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMakeRepo.mockReturnValue({
      createTable: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
    });
  });

  describe("initMain", () => {
    it("creates main spreadsheet with correct config", async () => {
      const { StoreRegistryService } = await import("./StoreRegistryService");

      const config = {
        Stores: {
          path: "apps/pos_umkm/main",
          columns: [
            "store_id",
            "store_name",
            "drive_folder_id",
            "owner_email",
            "my_role",
            "joined_at",
            "deleted_at",
          ],
        },
      };

      const result = await StoreRegistryService.initMain(config);

      expect(mockStoreFolderService.ensureFolder).toHaveBeenCalledWith([
        "apps",
        "pos_umkm",
      ]);
      expect(mockStoreFolderService.createSpreadsheet).toHaveBeenCalledWith(
        "main",
        "folder-id-123",
        ["Stores"],
      );
      expect(mockMakeRepo).toHaveBeenCalledWith("spreadsheet-id-456", "Stores");
      expect(result).toBe("spreadsheet-id-456");
    }, 10000);
  });

  describe("migrate", () => {
    it("creates multiple spreadsheets from config (multi-spreadsheet mode)", async () => {
      const { MigrationService } = await import("./MigrationService");

      const config: MigrationPayload = {
        sheet: {
          Categories: {
            path: "apps/pos_umkm/stores/<storeId>/master",
            columns: ["id", "name"],
          },
        },
        monthlySheet: {
          sheet: {
            Transactions: {
              path: "apps/pos_umkm/stores/<storeId>/transactions/transaction_<year>-<month>",
              columns: ["id", "total"],
            },
          },
        },
      };

      const result = await MigrationService.migrate(
        "store-abc",
        new Date("2026-04-15"),
        config,
      );

      expect(result).toEqual({
        "apps/pos_umkm/stores/store-abc/master": "spreadsheet-id-456",
        "apps/pos_umkm/stores/store-abc/transactions/transaction_2026-04":
          "spreadsheet-id-456",
      });
    });

    it("creates single spreadsheet from config (single mode)", async () => {
      const { MigrationService } = await import("./MigrationService");

      const config: MigrationPayload = {
        sheet: {
          Categories: {
            path: "apps/pos_umkm/stores/<storeId>/data",
            columns: ["id", "name"],
          },
          Products: {
            path: "apps/pos_umkm/stores/<storeId>/data",
            columns: ["id", "category_id", "price"],
          },
          Transaction_Items: {
            path: "apps/pos_umkm/stores/<storeId>/data_items",
            columns: ["id", "transaction_id"],
          },
        },
      };

      const result = await MigrationService.migrate(
        "store-xyz",
        new Date("2026-12-01"),
        config,
      );

      expect(result).toEqual({
        "apps/pos_umkm/stores/store-xyz/data": "spreadsheet-id-456",
        "apps/pos_umkm/stores/store-xyz/data_items": "spreadsheet-id-456",
      });
    });

    it("handles custom folder structure", async () => {
      const { MigrationService } = await import("./MigrationService");

      const config: MigrationPayload = {
        sheet: {
          Categories: {
            path: "apps/pos_umkm/stores/<storeId>/folders/categories",
            columns: ["id"],
          },
        },
      };

      const result = await MigrationService.migrate(
        "store-999",
        new Date("2025-01-01"),
        config,
      );

      expect(result).toEqual({
        "apps/pos_umkm/stores/store-999/folders/categories":
          "spreadsheet-id-456",
      });
    });

    it("returns empty object when config is empty", async () => {
      const { MigrationService } = await import("./MigrationService");

      const config: MigrationPayload = { sheet: {} };
      const result = await MigrationService.migrate(
        "store-test",
        new Date(),
        config,
      );

      expect(result).toEqual({});
      expect(mockStoreFolderService.createSpreadsheet).not.toHaveBeenCalled();
    });
  });

  describe("listStores", () => {
    it("returns parsed store records", async () => {
      mockMakeRepo.mockReturnValue({
        getAll: vi.fn().mockResolvedValue([
          {
            store_id: "s1",
            store_name: "Toko A",
            drive_folder_id: "f1",
          },
          {
            store_id: "s2",
            store_name: "Toko B",
            drive_folder_id: "f2",
          },
        ]),
      });

      const { StoreRegistryService } = await import("./StoreRegistryService");
      const stores = await StoreRegistryService.listStores("main-id");

      expect(stores).toEqual([
        {
          store_id: "s1",
          store_name: "Toko A",
          drive_folder_id: "f1",
          owner_email: "",
          my_role: "owner",
          joined_at: "",
        },
        {
          store_id: "s2",
          store_name: "Toko B",
          drive_folder_id: "f2",
          owner_email: "",
          my_role: "owner",
          joined_at: "",
        },
      ]);
    });

    it("filters out invalid rows", async () => {
      mockMakeRepo.mockReturnValue({
        getAll: vi
          .fn()
          .mockResolvedValue([
            { store_id: "s1", drive_folder_id: "f1" },
            { store_id: "", drive_folder_id: "f2" },
            { store_id: "s3", drive_folder_id: "" },
            {},
          ]),
      });

      const { StoreRegistryService } = await import("./StoreRegistryService");
      const stores = await StoreRegistryService.listStores("main-id");

      expect(stores).toEqual([
        {
          store_id: "s1",
          store_name: "",
          drive_folder_id: "f1",
          owner_email: "",
          my_role: "owner",
          joined_at: "",
        },
      ]);
    });

    it("returns empty array when no main spreadsheet", async () => {
      const { StoreRegistryService } = await import("./StoreRegistryService");
      const stores = await StoreRegistryService.listStores(
        undefined as unknown as string,
      );

      expect(stores).toEqual([]);
    });
  });
});
