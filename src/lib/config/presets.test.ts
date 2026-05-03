/**
 * presets.test.ts — Tests for presets.ts
 *
 * Tests define expected structure inline - NOT coupled to JSON files.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_TAB_HEADERS,
  getAllTabHeaders,
  getTabHeaders,
  getTabNames,
  MAIN_PRESET,
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
  STORE_MULTI_PRESET,
  STORE_PRESETS,
  STORE_SINGLE_PRESET,
} from "./presets";

const EXPECTED_MAIN = {
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

const EXPECTED_STORE_MULTI = {
  sheet: {
    Settings: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "key", "value", "updated_at"],
    },
    Members: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "google_user_id",
        "email",
        "name",
        "role",
        "invited_at",
        "deleted_at",
      ],
    },
    Categories: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "name", "created_at", "deleted_at"],
    },
    Products: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "category_id",
        "name",
        "sku",
        "price",
        "stock",
        "has_variants",
        "created_at",
        "deleted_at",
      ],
    },
    Variants: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "product_id",
        "option_name",
        "option_value",
        "price",
        "stock",
        "created_at",
        "deleted_at",
      ],
    },
    Customers: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "name", "phone", "email", "created_at", "deleted_at"],
    },
    Monthly_Sheets: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "year_month", "spreadsheetId", "created_at"],
    },
  },
  monthlySheet: {
    sheet: {
      Transactions: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "created_at",
          "cashier_id",
          "customer_id",
          "subtotal",
          "discount_type",
          "discount_value",
          "discount_amount",
          "tax",
          "total",
          "payment_method",
          "cash_received",
          "change",
          "receipt_number",
          "notes",
        ],
      },
      Transaction_Items: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "transaction_id",
          "product_id",
          "variant_id",
          "name",
          "price",
          "quantity",
          "subtotal",
        ],
      },
      Refunds: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "transaction_id",
          "product_id",
          "product_name",
          "qty",
          "unit_price",
          "reason",
          "created_at",
        ],
      },
      Audit_Log: {
        path: "apps/pos_umkm/stores/<storeId>/logs/<year>/log_<year>-<month>",
        columns: ["id", "event", "data", "created_at"],
      },
      Purchase_Order_Items: {
        path: "apps/pos_umkm/stores/<storeId>/po/<year>/po_<year>-<month>",
        columns: [
          "id",
          "order_id",
          "product_id",
          "product_name",
          "qty",
          "cost_price",
          "created_at",
        ],
      },
      Purchase_Orders: {
        path: "apps/pos_umkm/stores/<storeId>/po/<year>/po_<year>-<month>",
        columns: ["id", "supplier", "status", "created_at", "deleted_at"],
      },
      Stock_Log: {
        path: "apps/pos_umkm/stores/<storeId>/stock/<year>/stock_<year>-<month>",
        columns: [
          "id",
          "product_id",
          "reason",
          "qty_before",
          "qty_after",
          "created_at",
        ],
      },
    },
  },
};

const EXPECTED_STORE_SINGLE = {
  sheet: {
    Settings: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "key", "value", "updated_at"],
    },
    Members: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "google_user_id",
        "email",
        "name",
        "role",
        "invited_at",
        "deleted_at",
      ],
    },
    Categories: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "name", "created_at", "deleted_at"],
    },
    Products: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "category_id",
        "name",
        "sku",
        "price",
        "stock",
        "has_variants",
        "created_at",
        "deleted_at",
      ],
    },
    Variants: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: [
        "id",
        "product_id",
        "option_name",
        "option_value",
        "price",
        "stock",
        "created_at",
        "deleted_at",
      ],
    },
    Customers: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "name", "phone", "email", "created_at", "deleted_at"],
    },
    Monthly_Sheets: {
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "year_month", "spreadsheetId", "created_at"],
    },
  },
  monthlySheet: {
    sheet: {
      Transactions: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "created_at",
          "cashier_id",
          "customer_id",
          "subtotal",
          "discount_type",
          "discount_value",
          "discount_amount",
          "tax",
          "total",
          "payment_method",
          "cash_received",
          "change",
          "receipt_number",
          "notes",
        ],
      },
      Transaction_Items: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "transaction_id",
          "product_id",
          "variant_id",
          "name",
          "price",
          "quantity",
          "subtotal",
        ],
      },
      Refunds: {
        path: "apps/pos_umkm/stores/<storeId>/transactions/<year>/transaction_<year>-<month>",
        columns: [
          "id",
          "transaction_id",
          "product_id",
          "product_name",
          "qty",
          "unit_price",
          "reason",
          "created_at",
        ],
      },
      Audit_Log: {
        path: "apps/pos_umkm/stores/<storeId>/logs/<year>/log_<year>-<month>",
        columns: ["id", "event", "data", "created_at"],
      },
      Purchase_Order_Items: {
        path: "apps/pos_umkm/stores/<storeId>/po/<year>/po_<year>-<month>",
        columns: [
          "id",
          "order_id",
          "product_id",
          "product_name",
          "qty",
          "cost_price",
          "created_at",
        ],
      },
      Purchase_Orders: {
        path: "apps/pos_umkm/stores/<storeId>/po/<year>/po_<year>-<month>",
        columns: ["id", "supplier", "status", "created_at", "deleted_at"],
      },
      Stock_Log: {
        path: "apps/pos_umkm/stores/<storeId>/stock/<year>/stock_<year>-<month>",
        columns: [
          "id",
          "product_id",
          "reason",
          "qty_before",
          "qty_after",
          "created_at",
        ],
      },
    },
  },
};

describe("presets", () => {
  describe("MAIN_PRESET matches expected", () => {
    it("full structure", () => {
      expect(MAIN_PRESET).toEqual(EXPECTED_MAIN);
    });
  });

  describe("STORE_PRESETS.multi matches expected", () => {
    it("full structure", () => {
      expect(STORE_PRESETS.multi).toEqual(EXPECTED_STORE_MULTI);
    });
  });

  describe("STORE_PRESETS.single matches expected", () => {
    it("full structure", () => {
      expect(STORE_PRESETS.single).toEqual(EXPECTED_STORE_SINGLE);
    });
  });

  describe("getTabHeaders", () => {
    it("extracts all sheet headers from multi config", () => {
      const headers = getTabHeaders(STORE_MULTI_PRESET);
      expect(headers.Categories).toEqual([
        "id",
        "name",
        "created_at",
        "deleted_at",
      ]);
    });

    it("extracts monthly sheet headers when present", () => {
      const headers = getTabHeaders(STORE_MULTI_PRESET);
      expect(headers.Transactions).toContain("id");
      expect(headers.Transactions).toContain("total");
    });

    it("extracts all headers from single config", () => {
      const headers = getTabHeaders(STORE_SINGLE_PRESET);
      expect(headers.Categories).toBeDefined();
      expect(headers.Transactions).toBeDefined();
    });
  });

  describe("getTabNames", () => {
    it("returns correct structure for multi", () => {
      const names = getTabNames(STORE_MULTI_PRESET);
      expect(names.main).toEqual(["Stores"]);
      expect(names.sheet).toContain("Categories");
      expect(names.monthly).toContain("Transactions");
    });

    it("returns monthly sheets for single", () => {
      const names = getTabNames(STORE_SINGLE_PRESET);
      expect(names.monthly).toContain("Transactions");
    });
  });

  describe("getAllTabHeaders", () => {
    it("combines main and store headers", () => {
      const headers = getAllTabHeaders(STORE_MULTI_PRESET);
      expect(headers.Stores).toBeDefined();
      expect(headers.Categories).toBeDefined();
      expect(headers.Transactions).toBeDefined();
    });
  });

  describe("exported constants", () => {
    it("MAIN_TAB_HEADERS has Stores", () => {
      expect(MAIN_TAB_HEADERS.Stores).toEqual(EXPECTED_MAIN.Stores.columns);
    });

    it("MAIN_TABS is ['Stores']", () => {
      expect(MAIN_TABS).toEqual(["Stores"]);
    });

    it("MASTER_TAB_HEADERS has all master sheets", () => {
      expect(MASTER_TAB_HEADERS.Categories).toBeDefined();
      expect(MASTER_TAB_HEADERS.Products).toBeDefined();
    });

    it("MONTHLY_TAB_HEADERS has all monthly sheets", () => {
      expect(MONTHLY_TAB_HEADERS.Transactions).toBeDefined();
      expect(MONTHLY_TAB_HEADERS.Transaction_Items).toBeDefined();
    });

    it("MASTER_TABS contains expected sheets", () => {
      expect(MASTER_TABS).toContain("Categories");
      expect(MASTER_TABS).toContain("Products");
    });

    it("MONTHLY_TABS contains expected sheets", () => {
      expect(MONTHLY_TABS).toContain("Transactions");
      expect(MONTHLY_TABS).toContain("Refunds");
    });

    it("ALL_TAB_HEADERS has all keys from all sources", () => {
      expect(Object.keys(ALL_TAB_HEADERS)).toContain("Stores");
      expect(Object.keys(ALL_TAB_HEADERS)).toContain("Categories");
      expect(Object.keys(ALL_TAB_HEADERS)).toContain("Transactions");
    });

    it("STORE_MULTI_PRESET equals STORE_PRESETS.multi", () => {
      expect(STORE_MULTI_PRESET).toBe(STORE_PRESETS.multi);
    });

    it("STORE_SINGLE_PRESET equals STORE_PRESETS.single", () => {
      expect(STORE_SINGLE_PRESET).toBe(STORE_PRESETS.single);
    });
  });
});
