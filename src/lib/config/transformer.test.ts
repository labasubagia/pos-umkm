/**
 * transformer.test.ts — Tests for config transformer
 *
 * Tests assert full result objects for clear visibility.
 */
import { describe, expect, it } from "vitest";
import {
  extractFolders,
  transformMainConfig,
  transformMigrationPayload,
} from "./transformer";
import type { MigrationPayload } from "./types";

describe("transformMigrationPayload", () => {
  it("handles multi-spreadsheet preset (current default)", () => {
    const config: MigrationPayload = {
      sheet: {
        Categories: {
          path: "apps/pos_umkm/stores/<storeId>/master",
          columns: ["id", "name"],
        },
        Products: {
          path: "apps/pos_umkm/stores/<storeId>/master",
          columns: ["id", "name", "price"],
        },
      },
      monthlySheet: {
        sheet: {
          Transactions: {
            path: "apps/pos_umkm/stores/<storeId>/transactions/transaction_<year>-<month>",
            columns: ["id", "total"],
          },
          Transaction_Items: {
            path: "apps/pos_umkm/stores/<storeId>/transactions/transaction_<year>-<month>",
            columns: ["id", "transaction_id", "name"],
          },
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "store-123",
      new Date("2026-04-15"),
    );

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "master",
          pathParts: ["apps", "pos_umkm", "stores", "store-123"],
          sheets: {
            Categories: {
              path: "apps/pos_umkm/stores/store-123/master",
              columns: ["id", "name"],
            },
            Products: {
              path: "apps/pos_umkm/stores/store-123/master",
              columns: ["id", "name", "price"],
            },
          },
        },
        {
          name: "transaction_2026-04",
          pathParts: [
            "apps",
            "pos_umkm",
            "stores",
            "store-123",
            "transactions",
          ],
          sheets: {
            Transactions: {
              path: "apps/pos_umkm/stores/store-123/transactions/transaction_2026-04",
              columns: ["id", "total"],
            },
            Transaction_Items: {
              path: "apps/pos_umkm/stores/store-123/transactions/transaction_2026-04",
              columns: ["id", "transaction_id", "name"],
            },
          },
        },
      ],
    });
  });

  it("handles single spreadsheet mode", () => {
    const config: MigrationPayload = {
      sheet: {
        Categories: {
          path: "apps/pos_umkm/stores/<storeId>/data",
          columns: ["id", "name"],
        },
        Products: {
          path: "apps/pos_umkm/stores/<storeId>/data",
          columns: ["id", "name", "price"],
        },
        Transaction_Items: {
          path: "apps/pos_umkm/stores/<storeId>/data_items",
          columns: ["id", "transaction_id"],
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "store-456",
      new Date("2026-12-01"),
    );

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "data",
          pathParts: ["apps", "pos_umkm", "stores", "store-456"],
          sheets: {
            Categories: {
              path: "apps/pos_umkm/stores/store-456/data",
              columns: ["id", "name"],
            },
            Products: {
              path: "apps/pos_umkm/stores/store-456/data",
              columns: ["id", "name", "price"],
            },
          },
        },
        {
          name: "data_items",
          pathParts: ["apps", "pos_umkm", "stores", "store-456"],
          sheets: {
            Transaction_Items: {
              path: "apps/pos_umkm/stores/store-456/data_items",
              columns: ["id", "transaction_id"],
            },
          },
        },
      ],
    });
  });

  it("handles custom paths with different folder structures", () => {
    const config: MigrationPayload = {
      sheet: {
        Categories: {
          path: "apps/pos_umkm/stores/<storeId>/folders/categories",
          columns: ["id", "name"],
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "abc-999",
      new Date("2025-01-01"),
    );

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "categories",
          pathParts: ["apps", "pos_umkm", "stores", "abc-999", "folders"],
          sheets: {
            Categories: {
              path: "apps/pos_umkm/stores/abc-999/folders/categories",
              columns: ["id", "name"],
            },
          },
        },
      ],
    });
  });

  it("replaces placeholders correctly", () => {
    const config: MigrationPayload = {
      sheet: {
        Data: {
          path: "apps/pos_umkm/stores/<storeId>/<year>-<month>",
          columns: ["id"],
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "store-xyz",
      new Date("2026-03-10"),
    );

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "2026-03",
          pathParts: ["apps", "pos_umkm", "stores", "store-xyz"],
          sheets: {
            Data: {
              path: "apps/pos_umkm/stores/store-xyz/2026-03",
              columns: ["id"],
            },
          },
        },
      ],
    });
  });

  it("handles monthlySheet with year subfolder", () => {
    const config: MigrationPayload = {
      sheet: {},
      monthlySheet: {
        sheet: {
          Transactions: {
            path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
            columns: ["id"],
          },
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "store-111",
      new Date("2027-06-15"),
    );

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "transaction_2027-06",
          pathParts: [
            "apps",
            "pos_umkm",
            "stores",
            "store-111",
            "transactions",
            "2027",
          ],
          sheets: {
            Transactions: {
              path: "apps/pos_umkm/stores/store-111/transactions/2027/transaction_2027-06",
              columns: ["id"],
            },
          },
        },
      ],
    });
  });
});

describe("transformMainConfig", () => {
  it("transforms main config correctly", () => {
    const config = {
      Stores: {
        path: "apps/pos_umkm/main",
        columns: ["store_id", "store_name"],
      },
    };

    const result = transformMainConfig(config);

    expect(result).toEqual({
      spreadsheets: [
        {
          name: "main",
          pathParts: ["apps", "pos_umkm"],
          sheets: {
            Stores: {
              path: "apps/pos_umkm/main",
              columns: ["store_id", "store_name"],
            },
          },
        },
      ],
    });
  });
});

describe("extractFolders", () => {
  it("extracts all folder paths for parent folders (not spreadsheet itself)", () => {
    const config: MigrationPayload = {
      sheet: {
        Categories: {
          path: "apps/pos_umkm/stores/<storeId>/master",
          columns: ["id"],
        },
      },
    };

    const result = transformMigrationPayload(
      config,
      "store-abc",
      new Date("2026-04-01"),
    );
    const folders = extractFolders(result);

    expect(folders).toEqual([
      ["apps"],
      ["apps", "pos_umkm"],
      ["apps", "pos_umkm", "stores"],
      ["apps", "pos_umkm", "stores", "store-abc"],
    ]);
  });

  it("returns empty array when no pathParts", () => {
    const result = transformMainConfig({
      Stores: { path: "main", columns: ["id"] },
    });
    const folders = extractFolders(result);
    expect(folders).toEqual([]);
  });
});
