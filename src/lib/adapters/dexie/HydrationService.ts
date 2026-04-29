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

import { getActiveStoreMap } from "../../../store/storeMapStore";
import { useSyncStore } from "../../../store/syncStore";
import { ALL_TAB_HEADERS } from "../../schema";
import { SheetRepository } from "../SheetRepository";
import type { PosUmkmDatabase } from "./db";

/** How old a hydration timestamp must be before we re-fetch (5 minutes). */
const STALE_MS = 5 * 60 * 1000;

interface HydrationTarget {
  sheetName: string;
  spreadsheetId: string;
}

export class HydrationService {
  private readonly getToken: () => string;
  private readonly db: PosUmkmDatabase;

  constructor(getToken: () => string, db: PosUmkmDatabase) {
    this.getToken = getToken;
    this.db = db;
  }

  /**
   * Hydrates all tables for the active store context.
   * Called once after successful login and store activation.
   * Skips tables that already have fresh (< STALE_MS) data.
   *
   * Reads spreadsheet IDs from the store map — no need to pass them explicitly.
   */
  async hydrateAll(): Promise<void> {
    const storeMap = getActiveStoreMap().getState();
    const targets: HydrationTarget[] = [];

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
    await this.hydrateTable({ sheetName, spreadsheetId }, true);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async hydrateTable(
    { sheetName, spreadsheetId }: HydrationTarget,
    force = false,
  ): Promise<void> {
    // Key is scoped to spreadsheetId so different stores (and monthly sheet
    // rollovers with new spreadsheetIds) get independent freshness tracking.
    const metaKey = `${spreadsheetId}_${sheetName}`;

    // Skip if recently hydrated and no force flag
    if (!force) {
      const meta = await this.db._syncMeta.get(metaKey);
      if (meta) {
        const age = Date.now() - new Date(meta.value).getTime();
        if (age < STALE_MS) return;
      }
    }

    // Skip if there are pending outbox entries for this table —
    // applying remote data would overwrite unsynced local writes.
    const pendingForTable = await this.db._outbox
      .where("sheetName")
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
      // getAll() already filters soft-deleted rows in Google adapter.
      // We store all rows including soft-deleted ones in Dexie so that
      // DexieSheetRepository.getAll() can filter them too.
      const rawRows = await this.getRawRows(spreadsheetId, sheetName);
      // Normalize rows that use store_id as their primary identifier (Stores table).
      // Google Sheets headers for Stores are ['store_id', ...] with no 'id' column.
      // Dexie requires 'id' as primary key, so we map store_id → id when id is absent.
      const normalizedRows = rawRows.map((r) => {
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
      await this.db.transaction("rw", this.db.table(sheetName), async () => {
        await this.db.table(sheetName).clear();
        if (validRows.length > 0) {
          await this.db.table(sheetName).bulkPut(validRows);
        }
      });
      void repo; // suppress unused warning — used above for type inference context
      await this.db._syncMeta.put({
        key: metaKey,
        value: new Date().toISOString(),
      });
    } catch (err) {
      // Log but don't throw — partial hydration is better than none
      console.warn(`[HydrationService] Failed to hydrate "${sheetName}":`, err);
    }
  }

  /**
   * Fetches raw rows (including soft-deleted) from Google Sheets.
   * We bypass SheetRepository.getAll() which filters deleted rows because
   * we want the full dataset in Dexie to match Sheets exactly.
   */
  private async getRawRows(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<Record<string, unknown>[]> {
    const token = this.getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HydrationService: Sheets API ${res.status} for "${sheetName}": ${body}`,
      );
    }
    const data = await res.json();
    const rows: (string | number | boolean)[][] = data.values ?? [];
    if (rows.length < 2) return []; // header-only or empty
    const headers = rows[0] as string[];
    return rows.slice(1).map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? null;
      });
      return obj;
    });
  }
}
