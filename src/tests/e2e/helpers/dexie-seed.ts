/**
 * dexie-seed.ts — Seed Dexie IndexedDB tables in a Playwright browser context.
 *
 * Uses `window.__getDb` (exposed when VITE_E2E=true in db.ts) to access the
 * Dexie instance inside the page and bulk-insert test rows before assertions.
 *
 * Pattern:
 *   1. page.goto(url)
 *   2. waitFor(some always-visible element)  — confirms app loaded
 *   3. waitForHydration(page, storeId)       — wait for HydrationService to finish
 *   4. seedDexie(page, storeId, tables)      — safe to seed; no race with hydration
 *   5. page.reload()                         — _syncMeta is fresh → hydration skips
 *   6. assert UI                             — seeded data persists through reload
 */
import type { Page } from "@playwright/test";

type TableRows = Record<string, unknown[]>;

/**
 * Waits for HydrationService to finish hydrating all tables.
 *
 * HydrationService runs `table.clear()` inside an IDB transaction.  If we
 * call seedDexie() while hydration is still in-flight that transaction can
 * overwrite our inserts.  This function waits for the synchronous
 * `window.__lastHydratedAt` flag that HydrationService sets (when
 * VITE_E2E=true) immediately after all Promise.allSettled() clears complete.
 *
 * Using a synchronous window flag instead of async IndexedDB polling ensures
 * Playwright's waitForFunction evaluates the condition reliably on every poll.
 */
export async function waitForHydration(
  page: Page,
  _storeId?: string,
): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as Record<string, unknown>).__lastHydratedAt),
    undefined,
    { timeout: 15000 },
  );
}

/**
 * Seeds one or more Dexie tables with test rows via page.evaluate().
 * Each key in `tables` is a table name (e.g. 'Products', 'Categories').
 *
 * Always call waitForHydration() before this function to avoid a race with
 * HydrationService clearing the table concurrently.
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

/**
 * Reloads the page and waits for a given testId to become visible.
 * Use after seedDexie() to trigger React Query to re-read from Dexie.
 */
export async function reloadAndWait(page: Page, testId: string): Promise<void> {
  await page.reload();
  await page.getByTestId(testId).waitFor();
}
