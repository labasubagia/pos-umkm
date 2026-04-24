/**
 * E2E specs for Phase 3 — Product Catalog (T021–T023) and Phase 5 — Inventory (T034–T035).
 *
 * Auth is injected via localStorage. Data is seeded into Dexie where needed.
 * For category/product creation tests, no pre-seeding is necessary — the UI
 * form writes directly to Dexie.
 */
import { expect, test } from "@playwright/test";
import { navigateTo } from "./helpers/auth";
import { BASE, DEFAULT_STORE, injectAuthState } from "./helpers/auth-dexie";
import {
  reloadAndWait,
  seedDexie,
  waitForHydration,
} from "./helpers/dexie-seed";

const STORE = DEFAULT_STORE;
const now = new Date().toISOString();

async function signInToCatalog(page: Parameters<typeof injectAuthState>[0]) {
  await injectAuthState(page, STORE);
  await page.goto(`${BASE}/catalog`);
  await page.getByTestId("btn-tab-products").waitFor();
}

// ─── T021 — Categories CRUD ───────────────────────────────────────────────────

test.describe("Categories CRUD (T021)", () => {
  test("owner can create, rename, and delete a category", async ({ page }) => {
    await signInToCatalog(page);

    await page.getByTestId("btn-tab-categories").click();
    await page.getByRole("heading", { name: /kategori produk/i }).waitFor();

    // Create
    await page.getByTestId("btn-add-category").click();
    await page.getByTestId("input-category-name").fill("Minuman Segar");
    await page.getByTestId("btn-category-submit").click();
    await expect(
      page
        .locator('[data-testid^="category-name-"]')
        .filter({ hasText: "Minuman Segar" }),
    ).toBeVisible();

    // Rename
    await page.locator('[data-testid^="btn-edit-category-"]').click();
    await page.getByTestId("input-category-name").fill("Minuman Dingin");
    await page.getByTestId("btn-category-submit").click();
    await expect(
      page
        .locator('[data-testid^="category-name-"]')
        .filter({ hasText: "Minuman Dingin" }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid^="category-name-"]')
        .filter({ hasText: "Minuman Segar" }),
    ).toHaveCount(0);

    // Delete
    await page.locator('[data-testid^="btn-delete-category-"]').click();
    await expect(
      page
        .locator('[data-testid^="category-name-"]')
        .filter({ hasText: "Minuman Dingin" }),
    ).toHaveCount(0);
  });
});

// ─── T022 — Products CRUD ─────────────────────────────────────────────────────

test.describe("Products CRUD (T022)", () => {
  test("owner can add a product and it appears in the catalog product list", async ({
    page,
  }) => {
    await signInToCatalog(page);

    // Create category via UI (no pre-seeding needed)
    await page.getByTestId("btn-tab-categories").click();
    await page.getByRole("heading", { name: /kategori produk/i }).waitFor();
    await page.getByTestId("btn-add-category").click();
    await page.getByTestId("input-category-name").fill("Makanan");
    await page.getByTestId("btn-category-submit").click();
    await expect(
      page
        .locator('[data-testid^="category-name-"]')
        .filter({ hasText: "Makanan" }),
    ).toBeVisible();

    await page.getByTestId("btn-tab-products").click();
    await page.getByRole("heading", { name: "Produk", exact: true }).waitFor();

    await page.getByTestId("btn-add-product").click();
    await page.getByTestId("input-product-name").fill("Nasi Goreng Spesial");
    await page
      .getByTestId("select-product-category")
      .selectOption({ label: "Makanan" });
    await page.getByTestId("input-product-price").fill("15000");
    await page.getByTestId("input-product-stock").fill("50");
    await page.getByTestId("btn-product-submit").click();

    await expect(
      page
        .locator('[data-testid^="product-name-"]')
        .filter({ hasText: "Nasi Goreng Spesial" }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid^="product-price-"]')
        .filter({ hasText: "Rp 15.000" }),
    ).toBeVisible();
  });

  test("product added via catalog form appears in cashier product search", async ({
    page,
  }) => {
    // Pre-seed a category so the product form has something to pick from
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/catalog`);
    await page.getByTestId("btn-tab-products").waitFor();
    await waitForHydration(page);
    await seedDexie(page, STORE.storeId, {
      Categories: [
        {
          id: "cat-search",
          name: "Makanan",
          created_at: now,
          deleted_at: null,
        },
      ],
    });
    await reloadAndWait(page, "btn-tab-products");

    await page.getByTestId("btn-add-product").click();
    await page.getByTestId("input-product-name").fill("Mie Goreng");
    await page
      .getByTestId("select-product-category")
      .selectOption({ label: "Makanan" });
    await page.getByTestId("input-product-price").fill("12000");
    await page.getByTestId("input-product-stock").fill("20");
    await page.getByTestId("btn-product-submit").click();
    await expect(
      page
        .locator('[data-testid^="product-name-"]')
        .filter({ hasText: "Mie Goreng" }),
    ).toBeVisible();

    await navigateTo(page, `${BASE}/cashier`);
    await page.getByTestId("product-search-input").waitFor();
    await page.getByTestId("product-search-input").fill("Mie Goreng");
    await expect(
      page
        .locator('[data-testid^="product-card-"]')
        .filter({ hasText: "Mie Goreng" }),
    ).toBeVisible();
  });

  test("completing a sale decrements product stock", async ({ page }) => {
    const prodId = "prod-stock-test";

    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/cashier`);
    await page.getByTestId("product-search-input").waitFor();
    await waitForHydration(page);
    const monthlySheetSeed = [
      {
        id: "e2e-monthly-sheet-stock",
        year_month: now.slice(0, 7),
        spreadsheetId: STORE.monthlySpreadsheetId,
        created_at: now,
      },
    ];
    await seedDexie(page, STORE.storeId, {
      Products: [
        {
          id: prodId,
          category_id: "cat-1",
          name: "Produk Stok Test",
          sku: "STOK-01",
          price: 10000,
          stock: 20,
          has_variants: false,
          created_at: now,
          deleted_at: null,
        },
      ],
      Categories: [
        { id: "cat-1", name: "Umum", created_at: now, deleted_at: null },
      ],
      Monthly_Sheets: monthlySheetSeed,
    });
    await reloadAndWait(page, "product-search-input");
    await page
      .locator('[data-testid^="product-card-"]')
      .first()
      .waitFor({ timeout: 10000 });

    await page.getByTestId("product-search-input").fill("Produk Stok Test");
    await page.getByTestId(`product-card-${prodId}`).click();
    await page.getByTestId("btn-pay").click();
    await page.getByTestId("btn-method-qris").click();
    await page.getByTestId("btn-qris-confirm").click();
    await expect(page.getByTestId("receipt-success")).toBeVisible();
    await page.getByTestId("btn-receipt-close").click();

    await navigateTo(page, `${BASE}/catalog`);
    await page.getByTestId("btn-tab-products").click();
    await expect(page.getByTestId(`product-stock-${prodId}`)).toHaveText(
      "Stok: 19",
    );
  });
});

// ─── T034 — Stock Opname ──────────────────────────────────────────────────────

test.describe("Stock Opname (T034)", () => {
  test("owner can run stock opname and discrepancies are logged", async ({
    page,
  }) => {
    const prodId = "opname-prod-1";

    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/inventory`);
    await page.getByTestId("btn-tab-opname").waitFor();
    await waitForHydration(page);
    await seedDexie(page, STORE.storeId, {
      Products: [
        {
          id: prodId,
          category_id: "cat-1",
          name: "Produk Opname",
          sku: "OPNAME-01",
          price: 10000,
          stock: 50,
          has_variants: false,
          created_at: now,
          deleted_at: null,
        },
      ],
      Categories: [
        { id: "cat-1", name: "Umum", created_at: now, deleted_at: null },
      ],
    });
    await reloadAndWait(page, "btn-tab-opname");

    await expect(page.getByTestId("stock-opname-container")).toBeVisible();
    await expect(page.getByTestId(`opname-system-stock-${prodId}`)).toHaveText(
      "50",
    );

    await page.getByTestId(`opname-physical-input-${prodId}`).fill("45");
    await expect(page.getByTestId(`opname-diff-${prodId}`)).toHaveText("-5");

    await page.getByTestId("btn-save-opname").click();
    await expect(page.getByTestId("opname-success")).toBeVisible();
    // After save, system stock should update to 45
    await expect(page.getByTestId(`opname-system-stock-${prodId}`)).toHaveText(
      "45",
    );

    // Verify Stock_Log entry in Dexie
    const stockLog = await page.evaluate(
      async ({ storeId }) => {
        const db = (
          window as Record<
            string,
            (id: string) => {
              Stock_Log: { toArray: () => Promise<Record<string, unknown>[]> };
            }
          >
        ).__getDb(storeId);
        return db.Stock_Log.toArray();
      },
      { storeId: STORE.storeId },
    );
    const logEntry = stockLog.find(
      (e) => e.product_id === prodId && e.reason === "opname",
    );
    expect(logEntry).toBeTruthy();
    expect(logEntry?.qty_before).toBe(50);
    expect(logEntry?.qty_after).toBe(45);
  });
});

// ─── T035 — Purchase Orders ───────────────────────────────────────────────────

test.describe("Purchase Orders (T035)", () => {
  test("owner can create a purchase order and mark it as received, increasing stock", async ({
    page,
  }) => {
    const prodId = "po-prod-1";

    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/inventory`);
    await page.getByTestId("btn-tab-opname").waitFor();
    await waitForHydration(page);
    await seedDexie(page, STORE.storeId, {
      Products: [
        {
          id: prodId,
          category_id: "cat-1",
          name: "Produk PO",
          sku: "PO-01",
          price: 10000,
          stock: 20,
          has_variants: false,
          created_at: now,
          deleted_at: null,
        },
      ],
      Categories: [
        { id: "cat-1", name: "Umum", created_at: now, deleted_at: null },
      ],
    });
    await reloadAndWait(page, "btn-tab-opname");

    await page.getByTestId("btn-tab-purchase-orders").click();
    await expect(page.getByTestId("purchase-orders-container")).toBeVisible();

    await page.getByTestId("btn-create-po").click();
    await expect(page.getByTestId("po-form")).toBeVisible();
    await page.getByTestId("input-po-supplier").fill("Supplier Test ABC");
    await page
      .getByTestId("select-po-product-0")
      .selectOption({ value: prodId });
    await page.getByTestId("input-po-qty-0").fill("30");
    await page.getByTestId("input-po-cost-0").fill("8000");
    await page.getByTestId("btn-submit-po").click();

    const poRow = page.locator('[data-testid^="po-row-"]');
    await expect(poRow).toBeVisible();
    const poId = await poRow
      .getAttribute("data-testid")
      .then((id) => id?.replace("po-row-", "") ?? "");
    await expect(page.getByTestId(`po-supplier-${poId}`)).toHaveText(
      "Supplier Test ABC",
    );
    await page.getByTestId(`btn-receive-po-${poId}`).click();
    await expect(page.getByTestId(`po-status-${poId}`)).toHaveText("Diterima");

    // Verify stock in Dexie: 20 + 30 = 50
    const updatedStock = await page.evaluate(
      async ({ storeId, prodId }) => {
        const db = (
          window as Record<
            string,
            (id: string) => {
              Products: {
                get: (id: string) => Promise<{ stock: number } | undefined>;
              };
            }
          >
        ).__getDb(storeId);
        const p = await db.Products.get(prodId);
        return p?.stock ?? null;
      },
      { storeId: STORE.storeId, prodId },
    );
    expect(updatedStock).toBe(50);

    // Verify Stock_Log entry
    const stockLog = await page.evaluate(
      async ({ storeId }) => {
        const db = (
          window as Record<
            string,
            (id: string) => {
              Stock_Log: { toArray: () => Promise<Record<string, unknown>[]> };
            }
          >
        ).__getDb(storeId);
        return db.Stock_Log.toArray();
      },
      { storeId: STORE.storeId },
    );
    const logEntry = stockLog.find(
      (e) => e.product_id === prodId && e.reason === "purchase_order",
    );
    expect(logEntry).toBeTruthy();
    expect(logEntry?.qty_before).toBe(20);
    expect(logEntry?.qty_after).toBe(50);
  });
});
