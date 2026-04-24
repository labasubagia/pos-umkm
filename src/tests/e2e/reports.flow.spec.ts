/**
 * E2E specs for Phase 7 — Reports (T038–T042).
 *
 * Auth is injected via localStorage. Transaction data is seeded into Dexie
 * directly so reports can be computed without any Sheets API calls.
 */
import { expect, test } from "@playwright/test";
import { BASE, DEFAULT_STORE, injectAuthState } from "./helpers/auth-dexie";
import {
  reloadAndWait,
  seedDexie,
  waitForHydration,
} from "./helpers/dexie-seed";

const STORE = DEFAULT_STORE;
const today = new Date().toISOString().slice(0, 10);
const _now = new Date().toISOString();

const SEED_TRANSACTIONS = [
  {
    id: "e2e-tx-1",
    created_at: `${today}T08:00:00.000Z`,
    cashier_id: "e2e-owner-1",
    customer_id: null,
    subtotal: 30000,
    discount_type: "none",
    discount_value: 0,
    discount_amount: 0,
    tax: 0,
    total: 30000,
    payment_method: "CASH",
    cash_received: 30000,
    change: 0,
    receipt_number: "RCP-001",
    notes: null,
  },
  {
    id: "e2e-tx-2",
    created_at: `${today}T10:00:00.000Z`,
    cashier_id: "e2e-owner-1",
    customer_id: null,
    subtotal: 20000,
    discount_type: "none",
    discount_value: 0,
    discount_amount: 0,
    tax: 0,
    total: 20000,
    payment_method: "QRIS",
    cash_received: 0,
    change: 0,
    receipt_number: "RCP-002",
    notes: null,
  },
];

const SEED_TX_ITEMS = [
  {
    id: "e2e-item-1",
    transaction_id: "e2e-tx-1",
    product_id: "e2e-prod-1",
    variant_id: null,
    name: "Nasi Goreng",
    price: 15000,
    quantity: 2,
    subtotal: 30000,
  },
  {
    id: "e2e-item-2",
    transaction_id: "e2e-tx-2",
    product_id: "e2e-prod-2",
    variant_id: null,
    name: "Es Teh Manis",
    price: 5000,
    quantity: 4,
    subtotal: 20000,
  },
];

async function signInToReports(page: Parameters<typeof injectAuthState>[0]) {
  await injectAuthState(page, STORE);
  await page.goto(`${BASE}/${STORE.storeId}/reports/daily-summary`);
  await page.getByTestId("daily-summary-container").waitFor();
  await waitForHydration(page);
  await seedDexie(page, STORE.storeId, {
    Transactions: SEED_TRANSACTIONS,
    Transaction_Items: SEED_TX_ITEMS,
  });
  await reloadAndWait(page, "daily-summary-container");
}

test("owner can view today's sales summary", async ({ page }) => {
  await signInToReports(page);

  await page.getByTestId("daily-summary-container").waitFor();
  await page.getByTestId("btn-load-summary").click();
  await page.getByTestId("summary-revenue").waitFor();

  const revenue = await page.getByTestId("summary-revenue").textContent();
  // 30000 + 20000 = 50000
  expect(revenue).toContain("50.000");
});

test("owner can filter report by date range and see correct totals", async ({
  page,
}) => {
  await signInToReports(page);

  await page.getByTestId("subnav-reports-sales").click();
  await page.getByTestId("sales-report-container").waitFor();

  await page.getByTestId("input-start-date").fill(today);
  await page.getByTestId("input-end-date").fill(today);
  await page.getByTestId("btn-load-report").click();

  await page.getByTestId("report-total-revenue").waitFor();
  const total = await page.getByTestId("report-total-revenue").textContent();
  expect(total).toContain("50.000");
});

test("owner can complete end-of-day cash reconciliation", async ({ page }) => {
  await signInToReports(page);

  await page.getByTestId("subnav-reports-cash-reconciliation").click();
  await page.getByTestId("reconciliation-container").waitFor();

  await page.getByTestId("input-reconciliation-date").fill(today);
  await page.getByTestId("input-opening-balance").fill("100000");
  await page.getByTestId("input-closing-balance").fill("130000");
  await page.getByTestId("btn-calculate-reconciliation").click();

  await page.getByTestId("reconciliation-expected").waitFor();
  const expected = await page
    .getByTestId("reconciliation-expected")
    .textContent();
  // 100000 opening + 30000 CASH tx = 130000 expected
  expect(expected).toContain("130.000");

  await page.getByTestId("btn-save-reconciliation").click();
  await expect(page.getByTestId("btn-save-reconciliation")).not.toBeVisible({
    timeout: 3000,
  });
});
