/**
 * E2E specs for Phase 7 — Reports (T038–T042).
 *
 * Auth is injected via localStorage. Transaction data is provided as MSW
 * fixtures so HydrationService populates Dexie — no direct IndexedDB writes.
 */
import { expect, type TestInfo, test } from "@playwright/test";
import { BASE } from "./helpers/auth";
import { enableTestMode, loginAndSetup } from "./helpers/auth-flow";
import { makeId } from "./helpers/e2e-fixtures";
import { setMswFixtures } from "./helpers/msw-state";

// Use current month so the transactions fall inside the injected monthly sheet.
const REPORT_DATE = "2026-05-01";
function buildReportFixtures(testInfo: TestInfo) {
  const tx1 = makeId(testInfo, "tx-1");
  const tx2 = makeId(testInfo, "tx-2");
  const prod1 = makeId(testInfo, "prod-1");
  const prod2 = makeId(testInfo, "prod-2");
  return {
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
  page: Parameters<typeof enableTestMode>[0],
  fixtures: ReturnType<typeof buildReportFixtures>,
  path: string,
  readyTestId: string,
) {
  await enableTestMode(page);
  const { storeId, mainSpreadsheetId } = await loginAndSetup(page);

  await setMswFixtures(
    page,
    { storeId, mainSpreadsheetId },
    {
      Transactions: fixtures.transactions,
      Transaction_Items: fixtures.items,
    },
  );

  await page.goto(`${BASE}/${storeId}${path}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  await page.getByTestId(readyTestId).waitFor();
}

test("owner can view today's sales summary", async ({ page }, testInfo) => {
  const fixtures = buildReportFixtures(testInfo);
  await signInToReports(
    page,
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
  // After save, the reconciliation form should close/refresh — button disappears
  await expect(page.getByTestId("btn-save-reconciliation")).not.toBeVisible({
    timeout: 5000,
  });
});
