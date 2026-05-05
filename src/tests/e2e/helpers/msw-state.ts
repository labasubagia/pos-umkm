/**
 * msw-state.ts — Inject per-test fixture data for the MSW service worker.
 *
 * Replaces the old dexie-seed + route-stubs pattern.
 * Instead of writing directly into IndexedDB after hydration, we set fixture
 * data on window.__E2E_FIXTURES__ BEFORE navigation so that when HydrationService
 * calls the Sheets API, the MSW handler returns the fixture rows and Dexie is
 * populated naturally — no reload, no race with hydration.
 *
 * Usage (new auth flow):
 *   // 1. Enable test mode + full login flow:
 *   await enableTestMode(page);
 *   const { storeId, mainSpreadsheetId } = await loginAndSetup(page);
 *
 *   // 2. Set fixtures after login (uses storeId/mainSpreadsheetId from loginAndSetup):
 *   await setMswFixtures(page, { storeId, mainSpreadsheetId }, {
 *     Products: [{ id: 'p1', name: 'Nasi Goreng', price: 15000, ... }],
 *     Categories: [{ id: 'c1', name: 'Makanan', ... }],
 *   });
 *
 *   // 3. Navigate — MSW intercepts Sheets API, hydration populates Dexie:
 *   await page.goto(`${BASE}/${storeId}/cashier`);
 *   await page.waitForLoadState("domcontentloaded");
 *   await page.waitForTimeout(2000);
 *
 *   // 4. Wait for a UI element that requires the seeded data:
 *   await page.locator('[data-testid^="product-card-"]').first().waitFor();
 *
 * Table → spreadsheet mapping:
 *   Main spreadsheet:    Stores
 *   Master spreadsheet:  Settings, Members, Categories, Products, Variants,
 *                        Customers, Purchase_Orders, Purchase_Order_Items,
 *                        Stock_Log, Audit_Log
 *   Monthly spreadsheet: Transactions, Transaction_Items, Refunds
 */
import type { Page } from "@playwright/test";
import type { StoreConfig } from "./auth";

type TableName =
  | "Stores"
  | "Settings"
  | "Members"
  | "Categories"
  | "Products"
  | "Variants"
  | "Customers"
  | "Purchase_Orders"
  | "Purchase_Order_Items"
  | "Stock_Log"
  | "Audit_Log"
  | "Transactions"
  | "Transaction_Items"
  | "Refunds";

export type FixtureTables = Partial<
  Record<TableName, Record<string, unknown>[]>
>;

export type FixtureUpdater = (
  current: Record<string, Record<string, unknown>[]>,
) => Record<string, Record<string, unknown>[]>;

function buildFixtureMap(
  store: StoreConfig,
  tables: FixtureTables,
): Record<string, Record<string, unknown>[]> {
  const tableToSpreadsheetId: Record<TableName, string> = {
    Stores: store.mainSpreadsheetId,
    Settings: store.mainSpreadsheetId,
    Members: store.mainSpreadsheetId,
    Categories: store.mainSpreadsheetId,
    Products: store.mainSpreadsheetId,
    Variants: store.mainSpreadsheetId,
    Customers: store.mainSpreadsheetId,
    Purchase_Orders: store.mainSpreadsheetId,
    Purchase_Order_Items: store.mainSpreadsheetId,
    Stock_Log: store.mainSpreadsheetId,
    Audit_Log: store.mainSpreadsheetId,
    Transactions: store.mainSpreadsheetId,
    Transaction_Items: store.mainSpreadsheetId,
    Refunds: store.mainSpreadsheetId,
  };

  const fixtureMap: Record<string, Record<string, unknown>[]> = {};
  for (const [tableName, rows] of Object.entries(tables) as [
    TableName,
    Record<string, unknown>[],
  ][]) {
    const spreadsheetId = tableToSpreadsheetId[tableName];
    if (spreadsheetId && rows.length > 0) {
      fixtureMap[`${spreadsheetId}/${tableName}`] = rows;
    }
  }
  return fixtureMap;
}

/**
 * Injects fixture data that the MSW Sheets API handler will serve.
 *
 * Call setMswFixtures BEFORE navigating to pages that need the data.
 * The fixtures are merged across calls so you can inject data for multiple
 * stores/spreadsheets before navigation.
 */
export async function setMswFixtures(
  page: Page,
  store: StoreConfig,
  tables?: FixtureTables,
): Promise<void> {
  const fixtureMap = buildFixtureMap(store, tables ?? {});
  // Merge into any previously-injected fixture map (supports multiple stores).
  await page.addInitScript((fixtures) => {
    const existing =
      ((window as unknown as Record<string, unknown>).__E2E_FIXTURES__ as
        | Record<string, Record<string, unknown>[]>
        | undefined) ?? {};
    (window as unknown as Record<string, unknown>).__E2E_FIXTURES__ = {
      ...existing,
      ...fixtures,
    };
  }, fixtureMap);
}
