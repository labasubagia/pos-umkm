/**
 * dexie-seed.ts — Seed Dexie IndexedDB tables in a Playwright browser context.
 *
 * Uses `window.__getDb` (exposed when VITE_E2E=true in db.ts) to access the
 * Dexie instance inside the page and bulk-insert test rows before assertions.
 *
 * Call seedDexie() AFTER page.goto() (so the app is loaded and __getDb exists),
 * then reload() to trigger React Query to re-read from the now-seeded DB.
 */
import { type Page } from '@playwright/test'

type TableRows = Record<string, unknown[]>

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
      const db = (window as unknown as Record<string, (id: string) => Record<string, { bulkPut: (rows: unknown[]) => Promise<void> }>>)['__getDb'](storeId)
      for (const [tableName, rows] of Object.entries(tables)) {
        if (rows.length > 0) {
          await db[tableName].bulkPut(rows)
        }
      }
    },
    { storeId, tables },
  )
}

/**
 * Reloads the page and waits for a given testId to become visible.
 * Use after seedDexie() to trigger React Query to re-read from Dexie.
 */
export async function reloadAndWait(page: Page, testId: string): Promise<void> {
  await page.reload()
  await page.getByTestId(testId).waitFor()
}
