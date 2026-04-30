/**
 * DexieRepository.ts — ILocalRepository backed by IndexedDB (Dexie).
 *
 * Serves reads from IndexedDB (instant, offline-capable) and queues writes to
 * the _outbox table for later sync to Google Sheets by SyncManager.
 *
 * The `sheetName` constructor argument identifies which sheet tab this repo
 * targets. The spreadsheetId is resolved from the store map at enqueue time,
 * with the constructor-provided `spreadsheetId` as a fallback for setup code
 * that runs before the store map is populated.
 *
 * Write → IndexedDB immediately (ACID via Dexie transaction)
 *       → _outbox entry queued in the same transaction
 * Read  → IndexedDB always (SyncManager keeps it up-to-date with Sheets)
 *
 * batchUpsertBy is decomposed locally:
 *   - entries whose lookupValue exists in Dexie → batchUpdate
 *   - entries that are new                      → batchInsert
 * This avoids serialising makeNewRow into the outbox.
 */

import { getActiveStoreMap } from "../../../store/storeMapStore";
import { useAuthStore } from "../../../store/authStore";
import { useSyncStore } from "../../../store/syncStore";
import { generateId } from "../../uuid";
import type { ILocalRepository } from "../ILocalRepository";
import type { OutboxEntry, OutboxOperation, PosUmkmDatabase } from "./db";

export interface SyncTarget {
  spreadsheetId: string;
  sheetName: string;
}

export class DexieRepository<T extends Record<string, unknown>>
  implements ILocalRepository<T>
{
  private readonly db: PosUmkmDatabase;
  private readonly sheetName: string;
  private readonly fallbackSpreadsheetId: string;
  private readonly onAfterWrite: () => void;

  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite: () => void = () => {},
  ) {
    this.db = db;
    this.sheetName = syncTarget.sheetName;
    this.fallbackSpreadsheetId = syncTarget.spreadsheetId;
    this.onAfterWrite = onAfterWrite;
  }

  // ─── Reads (always from IndexedDB) ──────────────────────────────────────────

  async getAll(): Promise<T[]> {
    const rows = await this.db.table<T>(this.sheetName).toArray();
    return rows.filter((r) => !(r as Record<string, unknown>).deleted_at);
  }

  // ─── Writes (IndexedDB + outbox) ─────────────────────────────────────────────

  async batchInsert(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const rowsWithIds = rows.map((r) =>
      r.id ? r : { id: generateId(), ...r },
    );
    const tableName = this.sheetName;
    await this.db.transaction(
      "rw",
      [this.db.table(tableName), this.db._outbox],
      async () => {
        await this.db.table(tableName).bulkPut(rowsWithIds);
        await this.enqueue({
          op: "append",
          rows: rowsWithIds as Record<string, unknown>[],
        });
      },
    );
    this.refreshPendingCount();
    this.onAfterWrite();
  }

  async batchUpdate(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const tableName = this.sheetName;
    await this.db.transaction(
      "rw",
      [this.db.table(tableName), this.db._outbox],
      async () => {
        const ids = rows.map((r) => r.id as string);
        const existingRows = await this.db.table(tableName).bulkGet(ids);

        const mergedRows: Record<string, unknown>[] = [];
        for (let i = 0; i < rows.length; i++) {
          const existing = existingRows[i];
          if (!existing) continue; // row not locally cached yet — skip local update
          mergedRows.push({ ...existing, ...rows[i] });
        }
        if (mergedRows.length > 0) {
          await this.db.table(tableName).bulkPut(mergedRows);
        }

        // Translate to outbox vocabulary for SyncManager compatibility
        const updates = rows.flatMap(({ id, ...fields }) =>
          Object.entries(fields).map(([column, value]) => ({
            rowId: id as string,
            column,
            value,
          })),
        );
        await this.enqueue({ op: "batchUpdateCells", updates });
      },
    );
    this.refreshPendingCount();
    this.onAfterWrite();
  }

  /**
   * Insert-or-update rows by `id`. Checks which IDs exist in the local table,
   * routes existing rows to batchUpdate and new rows to batchInsert so each
   * part gets the correct outbox operation type.
   */
  async batchUpsert(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const tableName = this.sheetName;

    const ids = rows.map((r) => r.id as string);
    const existingRows = await this.db.table(tableName).bulkGet(ids);
    const existingSet = new Set(
      existingRows
        .map((r, i) => (r ? ids[i] : null))
        .filter((id): id is string => id !== null),
    );

    const toUpdate = rows.filter((r) => existingSet.has(r.id as string));
    const toInsert = rows.filter((r) => !existingSet.has(r.id as string));

    if (toUpdate.length > 0) await this.batchUpdate(toUpdate);
    if (toInsert.length > 0) await this.batchInsert(toInsert);
  }

  async softDelete(id: string): Promise<void> {
    const deletedAt = new Date().toISOString();
    const tableName = this.sheetName;
    await this.db.transaction(
      "rw",
      [this.db.table(tableName), this.db._outbox],
      async () => {
        await this.db.table(tableName).update(id, { deleted_at: deletedAt });
        await this.enqueue({ op: "softDelete", rowId: id });
      },
    );
    this.refreshPendingCount();
    this.onAfterWrite();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private enqueue(operation: OutboxOperation): Promise<number> {
    // Resolve spreadsheetId from the store map (preferred) with fallback
    // to the constructor-provided value for setup code that runs before
    // the store map is populated.
    const spreadsheetId = this.resolveSpreadsheetId();
    const entry: OutboxEntry = {
      mutationId: generateId(),
      spreadsheetId,
      sheetName: this.sheetName,
      operation,
      status: "pending",
      retries: 0,
      createdAt: new Date().toISOString(),
    };
    console.debug("[DexieRepository] enqueue outbox entry", {
      spreadsheetId: entry.spreadsheetId,
      sheetName: entry.sheetName,
      mutationId: entry.mutationId,
    });
    return this.db._outbox.add(entry);
  }

  /**
   * Resolves the spreadsheetId for this repo's sheetName.
   * Tries non-monthly sheets first, then current month's monthly sheets,
   * falls back to the constructor-provided value.
   */
  private resolveSpreadsheetId(): string {
    if (this.sheetName === "Stores") {
      const mainSpreadsheetId = useAuthStore.getState().mainSpreadsheetId;
      if (mainSpreadsheetId) return mainSpreadsheetId;
    }

    try {
      const storeMap = getActiveStoreMap().getState();
      // Non-monthly sheets (master, main)
      const meta = storeMap.getSheetMeta(this.sheetName);
      if (meta?.spreadsheet_id) return meta.spreadsheet_id;
      // Current month's transaction sheets
      const monthSheets = storeMap.getCurrentMonthSheets();
      if (monthSheets?.[this.sheetName]?.spreadsheet_id) {
        return monthSheets[this.sheetName].spreadsheet_id;
      }
    } catch {
      // Store map not initialized (e.g. during setup) — use fallback
    }

    if (this.fallbackSpreadsheetId) return this.fallbackSpreadsheetId;

    throw new Error(
      `DexieRepository: spreadsheetId for "${this.sheetName}" could not be resolved`,
    );
  }

  private refreshPendingCount(): void {
    // Use the total outbox count to avoid missing entries with other
    // transient statuses (e.g. 'syncing') which could cause the UI to
    // incorrectly show "Tersinkron" while entries still exist.
    this.db._outbox
      .count()
      .then((count) => {
        useSyncStore.getState().setPendingCount(count);
      })
      .catch(() => {
        /* non-critical */
      });
  }
}
