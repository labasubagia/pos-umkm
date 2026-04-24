/**
 * CashierPage.integration.test.tsx — Integration tests using real Dexie.
 *
 * No service-layer mocks. Data is seeded directly into fake-indexeddb before
 * each test. React Query → catalog.service → DexieSheetRepository → UI runs
 * end-to-end without any mock intermediary.
 *
 * The only boundary that is mocked is the Sheets sync layer (SyncManager /
 * HydrationService) so no network calls are attempted in jsdom.
 */
import "fake-indexeddb/auto";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupDexie, renderWithDexie } from "../test-utils/dexie-test-utils";
import CashierPage from "./CashierPage";

const STORE_ID = "cashier-integration-store";

// ─── Stub the sync boundary only ─────────────────────────────────────────────
// driveClient and syncManager are never called in reads/writes through Dexie.
// We mock them to prevent jsdom errors from SyncManager's setInterval / window.online.

vi.mock("../lib/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/adapters")>();
  return {
    ...actual,
    syncManager: { start: vi.fn(), stop: vi.fn(), triggerSync: vi.fn() },
    hydrationService: { hydrateAll: vi.fn(), forceHydrate: vi.fn() },
    reinitDexieLayer: vi.fn(),
    resetDexieLayer: vi.fn(),
  };
});

vi.mock("../modules/cashier/cashier.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/cashier/cashier.service")>();
  return {
    ...actual,
    // ensureMonthlySheetExists calls makeRepo → SheetRepository → network.
    // In integration tests the monthly sheet is always pre-existing (seeded).
    ensureMonthlySheetExists: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const category = {
  id: "cat-1",
  name: "Makanan",
  created_at: NOW,
  deleted_at: null,
};

const product1 = {
  id: "prod-1",
  category_id: "cat-1",
  name: "Nasi Goreng",
  sku: "NASGOR",
  price: 15000,
  stock: 20,
  has_variants: false,
  created_at: NOW,
  deleted_at: null,
};

const product2 = {
  id: "prod-2",
  category_id: "cat-1",
  name: "Es Teh Manis",
  sku: "ESTEH",
  price: 5000,
  stock: 50,
  has_variants: false,
  created_at: NOW,
  deleted_at: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(async () => {
  await cleanupDexie(STORE_ID);
  vi.clearAllMocks();
});

describe("CashierPage integration (real Dexie)", () => {
  it("products seeded in Dexie are shown in the product panel", async () => {
    await renderWithDexie(<CashierPage />, {
      storeId: STORE_ID,
      seed: async (db) => {
        await db.Categories.bulkPut([category]);
        await db.Products.bulkPut([product1, product2]);
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("product-card-prod-1")).toBeInTheDocument();
      expect(screen.getByTestId("product-card-prod-2")).toBeInTheDocument();
    });
  });

  it("clicking a product card adds it to the cart and updates the total", async () => {
    const user = userEvent.setup();
    await renderWithDexie(<CashierPage />, {
      storeId: STORE_ID,
      seed: async (db) => {
        await db.Categories.bulkPut([category]);
        await db.Products.bulkPut([product1]);
      },
    });

    await waitFor(() => screen.getByTestId("product-card-prod-1"));
    await user.click(screen.getByTestId("product-card-prod-1"));

    // Pay button should reflect the product price
    await waitFor(() => {
      expect(screen.getByTestId("btn-pay")).toHaveTextContent("15.000");
    });
  });

  it("search filters to matching products only", async () => {
    const user = userEvent.setup();
    await renderWithDexie(<CashierPage />, {
      storeId: STORE_ID,
      seed: async (db) => {
        await db.Categories.bulkPut([category]);
        await db.Products.bulkPut([product1, product2]);
      },
    });

    await waitFor(() => screen.getByTestId("product-search-input"));
    await user.type(screen.getByTestId("product-search-input"), "Nasi");

    await waitFor(() => {
      expect(screen.getByTestId("product-card-prod-1")).toBeInTheDocument();
      expect(screen.queryByTestId("product-card-prod-2")).toBeNull();
    });
  });

  it("pay button is disabled when cart is empty", async () => {
    await renderWithDexie(<CashierPage />, {
      storeId: STORE_ID,
      seed: async (db) => {
        await db.Categories.bulkPut([category]);
        await db.Products.bulkPut([product1]);
      },
    });

    await waitFor(() => screen.getByTestId("btn-pay"));
    expect(screen.getByTestId("btn-pay")).toBeDisabled();
  });
});
