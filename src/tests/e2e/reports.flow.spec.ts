/**
 * E2E specs for Phase 7 — Reports (T038–T042).
 *
 * Auth is injected via localStorage. Transaction data is seeded into Dexie
 * directly so reports can be computed without any Sheets API calls.
 */
import { expect, type TestInfo, test } from "@playwright/test";
import { BASE, injectAuthState, type StoreConfig } from "./helpers/auth-dexie";
import {
  reloadAndWait,
  seedDexie,
  waitForHydration,
  waitForTableRowCount,
} from "./helpers/dexie-seed";
import { makeId, makeStoreConfig } from "./helpers/e2e-fixtures";

const REPORT_DATE = "2026-06-01";
function buildReportFixtures(testInfo: TestInfo) {
  const store = makeStoreConfig(testInfo);
  const tx1 = makeId(testInfo, "tx-1");
  const tx2 = makeId(testInfo, "tx-2");
  const prod1 = makeId(testInfo, "prod-1");
  const prod2 = makeId(testInfo, "prod-2");
  return {
    store,
    transactions: [
      {
        id: tx1,
        created_at: `${REPORT_DATE}T08:00:00.000Z`,
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
        receipt_number: `RCP-${makeId(testInfo, "001")}`,
        notes: null,
      },
      {
        id: tx2,
        created_at: `${REPORT_DATE}T10:00:00.000Z`,
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
        receipt_number: `RCP-${makeId(testInfo, "002")}`,
        notes: null,
      },
    ],
    items: [
      {
        id: makeId(testInfo, "item-1"),
        transaction_id: tx1,
        product_id: prod1,
        variant_id: null,
        name: "Nasi Goreng",
        price: 15000,
        quantity: 2,
        subtotal: 30000,
      },
      {
        id: makeId(testInfo, "item-2"),
        transaction_id: tx2,
        product_id: prod2,
        variant_id: null,
        name: "Es Teh Manis",
        price: 5000,
        quantity: 4,
        subtotal: 20000,
      },
    ],
  };
}

async function signInToReports(
  page: Parameters<typeof injectAuthState>[0],
  store: StoreConfig,
  fixtures: ReturnType<typeof buildReportFixtures>,
  path: string,
  readyTestId: string,
) {
  await injectAuthState(page, store);
  await page.goto(`${BASE}/${store.storeId}${path}`);
  await page.getByTestId(readyTestId).waitFor();
  await waitForHydration(page);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await seedDexie(page, store.storeId, {
      Transactions: fixtures.transactions,
      Transaction_Items: fixtures.items,
    });
    await reloadAndWait(page, readyTestId);
    await waitForTableRowCount(
      page,
      store.storeId,
      "Transactions",
      fixtures.transactions.length,
    );
    await waitForTableRowCount(
      page,
      store.storeId,
      "Transaction_Items",
      fixtures.items.length,
    );

    const hasSeededRows = await page.evaluate(
      async ({ storeId, txIds, itemIds }) => {
        const db = (
          window as unknown as Record<
            string,
            (id: string) => {
              Transactions: {
                toArray: () => Promise<Array<{ id: string }>>;
              };
              Transaction_Items: {
                toArray: () => Promise<Array<{ id: string }>>;
              };
            }
          >
        ).__getDb(storeId);
        const txRows = await db.Transactions.toArray();
        const itemRows = await db.Transaction_Items.toArray();
        const txSet = new Set(txRows.map((row) => row.id));
        const itemSet = new Set(itemRows.map((row) => row.id));
        return (
          txIds.every((id) => txSet.has(id)) &&
          itemIds.every((id) => itemSet.has(id))
        );
      },
      {
        storeId: store.storeId,
        txIds: fixtures.transactions.map((row) => row.id),
        itemIds: fixtures.items.map((row) => row.id),
      },
    );
    if (hasSeededRows) return;
  }
}

test("owner can view today's sales summary", async ({ page }, testInfo) => {
  const fixtures = buildReportFixtures(testInfo);
  await signInToReports(
    page,
    fixtures.store,
    fixtures,
    "/reports/daily-summary",
    "daily-summary-container",
  );

  await page.getByTestId("daily-summary-container").waitFor();
  const summaryDateInput = page.getByTestId("input-summary-date");
  await summaryDateInput.fill(REPORT_DATE);
  await expect(summaryDateInput).toHaveValue(REPORT_DATE);
  await page.getByTestId("btn-load-summary").click();
  await page.getByTestId("summary-revenue").waitFor();

  const revenue = await page.getByTestId("summary-revenue").textContent();
  // 30000 + 20000 = 50000
  expect(revenue).toContain("50.000");
});

test("owner can filter report by date range and see correct totals", async ({
  page,
}, testInfo) => {
  const fixtures = buildReportFixtures(testInfo);
  await signInToReports(
    page,
    fixtures.store,
    fixtures,
    "/reports/sales",
    "sales-report-container",
  );

  await page.getByTestId("sales-report-container").waitFor();

  const startDateInput = page.getByTestId("input-start-date");
  const endDateInput = page.getByTestId("input-end-date");

  await startDateInput.fill(REPORT_DATE);
  await expect(startDateInput).toHaveValue(REPORT_DATE);
  await endDateInput.fill(REPORT_DATE);
  await expect(endDateInput).toHaveValue(REPORT_DATE);
  await page.getByTestId("btn-load-report").click();

  await page.getByTestId("report-total-revenue").waitFor();
  const total = await page.getByTestId("report-total-revenue").textContent();
  expect(total).toContain("50.000");
});

test("owner can complete end-of-day cash reconciliation", async ({
  page,
}, testInfo) => {
  const fixtures = buildReportFixtures(testInfo);
  await signInToReports(
    page,
    fixtures.store,
    fixtures,
    "/reports/cash-reconciliation",
    "reconciliation-container",
  );

  await page.getByTestId("reconciliation-container").waitFor();

  const reconciliationDateInput = page.getByTestId("input-reconciliation-date");
  await reconciliationDateInput.fill(REPORT_DATE);
  await expect(reconciliationDateInput).toHaveValue(REPORT_DATE);
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
