/**
 * dexie-seed.ts — Seed Dexie IndexedDB tables in a Playwright browser context.
 *
 * Uses `window.__getDb` (exposed by db.ts) to access the Dexie instance inside
 * the page and bulk-insert test rows before assertions.
 *
 * Use `seedDexie` only for stores that HydrationService never hydrates (e.g. a
 * secondary store like "store-b"). For the active store, use setMswFixtures so
 * HydrationService populates Dexie naturally via the MSW-intercepted Sheets API.
 */
import type { Page } from "@playwright/test";

type TableRows = Record<string, unknown[]>;

/**
 * Seeds one or more Dexie tables with test rows via page.evaluate().
 * Each key in `tables` is a table name (e.g. 'Products', 'Categories').
 */
export async function seedDexie(
  page: Page,
  storeId: string,
  tables: TableRows,
): Promise<void> {
  await page.evaluate(
    async ({ storeId, tables }) => {
      const db = (
        window as unknown as Record<
          string,
          (
            id: string,
          ) => Record<string, { bulkPut: (rows: unknown[]) => Promise<void> }>
        >
      ).__getDb(storeId);
      for (const [tableName, rows] of Object.entries(tables)) {
        if (rows.length > 0) {
          await db[tableName].bulkPut(rows);
        }
      }
    },
    { storeId, tables },
  );
}
