/**
 * flow-smoke.spec.ts — Simple smoke test using the new auth-flow helpers.
 *
 * Verifies: base URL → login → setup → cashier works with products showing.
 */
import { expect, test } from "@playwright/test";
import { enableTestMode, loginAndSetup } from "./helpers/auth-flow";
import { setMswFixtures } from "./helpers/msw-state";

const STORE = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
};

test("full auth flow smoke test", async ({ page }) => {
  // Add products fixtures before login
  const now = new Date().toISOString();
  await setMswFixtures(page, STORE, {
    Categories: [
      {
        id: "cat-1",
        name: "Makanan & Minuman",
        created_at: now,
        deleted_at: null,
      },
    ],
    Products: [
      {
        id: "prod-1",
        category_id: "cat-1",
        name: "Nasi Goreng",
        sku: "NASGOR",
        price: 15000,
        stock: 20,
        has_variants: false,
        created_at: now,
        deleted_at: null,
      },
      {
        id: "prod-2",
        category_id: "cat-1",
        name: "Es Teh Manis",
        sku: "ESTEH",
        price: 5000,
        stock: 50,
        has_variants: false,
        created_at: now,
        deleted_at: null,
      },
    ],
  });

  // Enable test mode before navigation
  await enableTestMode(page);

  // Go through login + setup flow
  const result = await loginAndSetup(page);

  console.log(`Store created: ${result.storeId}`);

  // Verify we're at cashier with products showing
  const bodyText = await page.locator("body").innerText();

  // Should show products
  expect(bodyText).toContain("Nasi Goreng");
  expect(bodyText).toContain("Es Teh Manis");

  // Should not show "no products" message
  expect(bodyText).not.toContain("Produk tidak ditemukan");
});
