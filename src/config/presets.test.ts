/**
 * presets.test.ts — Tests for presets.ts
 *
 * Tests define expected structure inline - NOT coupled to JSON files.
 */
import { describe, expect, it } from "vitest";
import {
  getAllTabHeaders,
  getTabHeaders,
  getTabNames,
  MAIN_PRESET,
  STORE_PRESETS,
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
  },
  monthlySheet: {
    prefixes: ["transaction", "log", "po", "stock"],
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
    Transactions: {
      path: "apps/pos_umkm/stores/<storeId>/data",
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
      path: "apps/pos_umkm/stores/<storeId>/data",
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
      path: "apps/pos_umkm/stores/<storeId>/data",
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
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "event", "data", "created_at"],
    },
    Purchase_Order_Items: {
      path: "apps/pos_umkm/stores/<storeId>/data",
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
      path: "apps/pos_umkm/stores/<storeId>/data",
      columns: ["id", "supplier", "status", "created_at", "deleted_at"],
    },
    Stock_Log: {
      path: "apps/pos_umkm/stores/<storeId>/data",
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
      const headers = getTabHeaders(EXPECTED_STORE_MULTI);
      expect(headers.Categories).toEqual([
        "id",
        "name",
        "created_at",
        "deleted_at",
      ]);
    });

    it("extracts monthly sheet headers when present", () => {
      const headers = getTabHeaders(EXPECTED_STORE_MULTI);
      expect(headers.Transactions).toContain("id");
      expect(headers.Transactions).toContain("total");
    });

    it("extracts all headers from single config", () => {
      const headers = getTabHeaders(EXPECTED_STORE_SINGLE);
      expect(headers.Categories).toBeDefined();
      expect(headers.Transactions).toBeDefined();
    });
  });

  describe("getTabNames", () => {
    it("returns correct structure for multi", () => {
      const names = getTabNames(EXPECTED_STORE_MULTI);
      expect(names.main).toEqual(["Stores"]);
      expect(names.sheet).toContain("Categories");
      expect(names.monthly).toContain("Transactions");
    });

    it("returns monthly sheets for single", () => {
      const names = getTabNames(EXPECTED_STORE_SINGLE);
      // Single store has all sheets (including monthly) in the sheet section
      expect(names.sheet).toContain("Transactions");
    });
  });

  describe("getAllTabHeaders", () => {
    it("combines main and store headers", () => {
      const headers = getAllTabHeaders(EXPECTED_STORE_MULTI);
      expect(headers.Stores).toBeDefined();
      expect(headers.Categories).toBeDefined();
      expect(headers.Transactions).toBeDefined();
    });
  });
});
