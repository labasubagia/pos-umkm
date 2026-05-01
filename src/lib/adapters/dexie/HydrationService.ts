/**
 * HydrationService.ts — Pulls Google Sheets data into IndexedDB on login.
 *
 * On first login (or when Dexie is empty), the app has no local data.
 * HydrationService fetches all relevant sheets from Google Sheets and
 * bulk-inserts them into Dexie so subsequent reads are instant and offline.
 *
 * Strategy:
 *   - Check _syncMeta for each table's `<table>_hydrated` timestamp
 *   - If never hydrated: fetch full sheet from Sheets, bulkPut to Dexie
 *   - If recently hydrated (< STALE_MS): skip (avoid redundant fetches)
 *   - If stale: re-fetch from Sheets, bulkPut (remote wins — Sheets is the
 *     source of truth during re-hydration; pending outbox entries are preserved)
 *
 * Re-hydration does NOT overwrite rows that have pending outbox entries
 * in the same table — those represent local edits not yet synced to Sheets
 * and would be regressed by a full remote-wins merge.
 * Instead: SyncManager drains the outbox first; hydration is skipped for
 * any table that has pending outbox entries.
 *
 * writeHeaders is never called during hydration — headers are Sheets-side only.
 */

import { useAuthStore } from "../../../store/authStore";
import { getCurrentStoreMapStore } from "../../../store/storeMapStore";
import { useSyncStore } from "../../../store/syncStore";
import { logger } from "../../logger";
import { ALL_TAB_HEADERS } from "../../schema";
import { SheetRepository } from "../SheetRepository";
import { parseSheetRows } from "../zod-schemas";
import type { Database } from "./db";

const STALE_MS = 5 * 60 * 1000;

interface HydrationTarget {
  sheetName: string;
  spreadsheetId: string;
}

export class HydrationService {
  private readonly getToken: () => string;
  private readonly db: Database;
  /** Global DB for cross-store tables (Stores). Never swapped on store switch. */
  private readonly mainDb: Database;

  constructor(getToken: () => string, db: Database, mainDb: Database) {
    this.getToken = getToken;
    this.db = db;
    this.mainDb = mainDb;
  }

  /**
   * Hydrates all tables for the active store context.
   * Called once after successful login and store activation.
   * Skips tables that already have fresh (< STALE_MS) data.
   *
   * Reads spreadsheet IDs from the store map — no need to pass them explicitly.
   */
  async hydrateAll(): Promise<void> {
    const storeMap = getCurrentStoreMapStore().getState();
    const targets: HydrationTarget[] = [];
    const mainSpreadsheetId = useAuthStore.getState().mainSpreadsheetId;

    if (mainSpreadsheetId) {
      // Stores is cross-store (lives in the main spreadsheet).
      // Hydrate it directly into the global mainDb so every store sees the
      // same list and per-store outbox entries never block this hydration.
      await this.hydrateTable(
        { sheetName: "Stores", spreadsheetId: mainSpreadsheetId },
        false,
        this.mainDb,
      );
    }

    // Non-monthly sheets (master, main)
    for (const [sheetName, meta] of Object.entries(storeMap.sheets)) {
      if (meta.spreadsheet_id) {
        targets.push({ sheetName, spreadsheetId: meta.spreadsheet_id });
      }
    }

    // Current month's transaction sheets
    const currentMonthSheets = storeMap.getCurrentMonthSheets();
    if (currentMonthSheets) {
      for (const [sheetName, meta] of Object.entries(currentMonthSheets)) {
        if (meta.spreadsheet_id) {
          targets.push({ sheetName, spreadsheetId: meta.spreadsheet_id });
        }
      }
    }

    // Filter out empty spreadsheetIds (e.g. monthlySpreadsheetId not yet created)
    const validTargets = targets.filter((t) => Boolean(t.spreadsheetId));

    await Promise.allSettled(validTargets.map((t) => this.hydrateTable(t)));

    // Signal page-level useEffects to re-fetch data from the now-populated Dexie cache.
    useSyncStore.getState().setLastHydratedAt(Date.now());

    // Expose a synchronous window flag for Playwright E2E tests so they can
    // reliably wait for all table.clear() transactions to complete before
    // seeding test data (avoids a race between seedDexie and hydrateTable).
    if (import.meta.env.VITE_E2E === "true") {
      (window as unknown as Record<string, unknown>).__lastHydratedAt =
        Date.now();
    }
  }

  /**
   * Forces a full re-hydration of a single table, bypassing the staleness check.
   * Used when the user explicitly triggers a "Sync now" from the UI.
   */
  async forceHydrate(sheetName: string, spreadsheetId: string): Promise<void> {
    const db = sheetName === "Stores" ? this.mainDb : this.db;
    await this.hydrateTable({ sheetName, spreadsheetId }, true, db);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async hydrateTable(
    { sheetName, spreadsheetId }: HydrationTarget,
    force = false,
    db?: Database,
  ): Promise<void> {
    const targetDb = db ?? this.db;
    // Key is scoped to spreadsheetId so different stores (and monthly sheet
    // rollovers with new spreadsheetIds) get independent freshness tracking.
    const metaKey = `${spreadsheetId}_${sheetName}`;

    // Skip if recently hydrated and no force flag
    if (!force) {
      const meta = await targetDb._syncMeta.get(metaKey);
      if (meta) {
        const age = Date.now() - new Date(meta.value).getTime();
        if (age < STALE_MS) return;
      }
    }

    // Skip if there are pending outbox entries for this table —
    // applying remote data would overwrite unsynced local writes.
    const pendingForTable = await targetDb._outbox
      .where("tableName")
      .equals(sheetName)
      .and((e) => e.status !== "failed" || e.retries < 5)
      .count();
    if (pendingForTable > 0) return;

    try {
      const repo = new SheetRepository<Record<string, unknown>>(
        spreadsheetId,
        sheetName,
        this.getToken,
        ALL_TAB_HEADERS[sheetName],
      );
      const rawRows = await repo.getAll();
      const parsedRows = parseSheetRows(sheetName, rawRows);
      // Normalize rows that use store_id as their primary identifier (Stores table).
      // Google Sheets headers for Stores are ['store_id', ...] with no 'id' column.
      // Dexie requires 'id' as primary key, so we map store_id → id when id is absent.
      const normalizedRows = parsedRows.map((r) => {
        if (
          (r.id == null || r.id === "") &&
          r.store_id != null &&
          r.store_id !== ""
        ) {
          return { ...r, id: r.store_id };
        }
        return r;
      });
      // Filter rows where the primary key (id) is missing — Google Sheets can
      // return trailing empty rows that parse to { id: null, ... } which IDB
      // rejects with a DataError when the key path yields no value.
      const validRows = normalizedRows.filter(
        (r) => r.id != null && r.id !== "",
      );
      // Clear the local table then re-populate from Sheets (full replace).
      // This removes rows that were deleted in Sheets and ensures the local cache
      // is an exact replica of the remote sheet — not an accumulation of upserts.
      // Wrapping in a transaction makes the clear + put atomic.
      await targetDb.transaction("rw", targetDb.table(sheetName), async () => {
        await targetDb.table(sheetName).clear();
        if (validRows.length > 0) {
          await targetDb.table(sheetName).bulkPut(validRows);
        }
      });
      void repo; // suppress unused warning — used above for type inference context
      await targetDb._syncMeta.put({
        key: metaKey,
        value: new Date().toISOString(),
      });
    } catch (err) {
      // Log but don't throw — partial hydration is better than none
      logger.warn(`[HydrationService] Failed to hydrate "${sheetName}":`, err);
    }
  }
}
