/**
 * DexieSheetRepository.ts — ISheetRepository backed by IndexedDB (Dexie).
 *
 * Implements the same ISheetRepository<T> interface as SheetRepository but
 * serves reads from IndexedDB (instant, offline-capable) and queues writes
 * to the _outbox table for later sync to Google Sheets by SyncManager.
 *
 * This is the offline-first adapter used in production (VITE_ADAPTER=google).
 * Feature modules see no difference — they call getRepos() and get this.
 *
 * Write → IndexedDB immediately (ACID via Dexie transaction)
 *       → _outbox entry queued in the same transaction
 * Read  → IndexedDB always (SyncManager keeps it up-to-date with Sheets)
 *
 * batchUpsertByKey is decomposed locally:
 *   - entries whose lookupValue exists in Dexie → batchUpdateCells
 *   - entries that are new                      → batchAppend
 * This avoids serialising the makeNewRow function into the outbox.
 *
 * writeHeaders bypasses the local cache — it targets the remote Sheet
 * directly and is only called during SetupWizard (requires online access).
 */
import type { ISheetRepository } from '../SheetRepository'
import { db } from './db'
import type { OutboxEntry, OutboxOperation } from './db'
import { generateId } from '../../uuid'
import { useSyncStore } from '../../../store/syncStore'

export class DexieSheetRepository<T extends Record<string, unknown>>
  implements ISheetRepository<T> {
  readonly spreadsheetId: string
  readonly sheetName: string

  /**
   * Factory that returns a remote SheetRepository for writeHeaders and
   * for SyncManager's drain path. Evaluated lazily so IDs in the auth
   * store are resolved at call time, not at construction time.
   */
  private readonly getRemoteRepo: () => ISheetRepository<T>

  constructor(
    spreadsheetId: string,
    sheetName: string,
    getRemoteRepo: () => ISheetRepository<T>,
  ) {
    this.spreadsheetId = spreadsheetId
    this.sheetName = sheetName
    this.getRemoteRepo = getRemoteRepo
  }

  // ─── Reads (always from IndexedDB) ──────────────────────────────────────────

  async getAll(): Promise<T[]> {
    const rows = await db.table<T>(this.sheetName).toArray()
    // Filter soft-deleted rows the same way as Google adapter
    return rows.filter((r) => !(r as Record<string, unknown>)['deleted_at'])
  }

  // ─── Writes (IndexedDB + outbox) ─────────────────────────────────────────────

  async batchAppend(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return
    const rowsWithIds = rows.map((r) =>
      r['id'] ? r : { id: generateId(), ...r },
    )
    await db.transaction('rw', [db.table(this.sheetName), db._outbox], async () => {
      await db.table(this.sheetName).bulkPut(rowsWithIds)
      await this.enqueue({ op: 'append', rows: rowsWithIds as Record<string, unknown>[] })
    })
    this.refreshPendingCount()
  }

  async batchUpdateCells(
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void> {
    if (updates.length === 0) return
    await db.transaction('rw', [db.table(this.sheetName), db._outbox], async () => {
      for (const { rowId, column, value } of updates) {
        const existing = await db.table(this.sheetName).get(rowId)
        if (!existing) continue // row not locally cached yet — skip local update
        await db.table(this.sheetName).update(rowId, { [column]: value })
      }
      await this.enqueue({ op: 'batchUpdateCells', updates })
    })
    this.refreshPendingCount()
  }

  /**
   * Decomposes batchUpsertByKey into primitives (append + batchUpdateCells)
   * that are individually outbox-able. This avoids serialising the makeNewRow
   * function into the outbox while keeping the Sheets-side behaviour identical.
   */
  async batchUpsertByKey(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    if (entries.length === 0) return

    // Read existing rows once to determine updates vs inserts
    const allRows = await db.table<Record<string, unknown>>(this.sheetName).toArray()
    const existingByKey = new Map(allRows.map((r) => [r[lookupColumn] as string, r]))

    const updates: Array<{ rowId: string; column: string; value: unknown }> = []
    const newRows: Record<string, unknown>[] = []

    for (const { lookupValue, value } of entries) {
      const existing = existingByKey.get(lookupValue)
      if (existing) {
        updates.push({ rowId: existing['id'] as string, column: updateColumn, value })
      } else {
        newRows.push(makeNewRow(lookupValue, value))
      }
    }

    if (updates.length > 0) await this.batchUpdateCells(updates)
    if (newRows.length > 0) await this.batchAppend(newRows as Array<Partial<T> & Record<string, unknown>>)
  }

  async softDelete(rowId: string): Promise<void> {
    const deletedAt = new Date().toISOString()
    await db.transaction('rw', [db.table(this.sheetName), db._outbox], async () => {
      await db.table(this.sheetName).update(rowId, { deleted_at: deletedAt })
      await this.enqueue({ op: 'softDelete', rowId })
    })
    this.refreshPendingCount()
  }

  /**
   * Passes through to the remote repo — only called during SetupWizard which
   * requires active internet. No local cache update needed (headers never change
   * after initial setup).
   */
  async writeHeaders(headers: string[]): Promise<void> {
    return this.getRemoteRepo().writeHeaders(headers)
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /** Adds a mutation to the outbox. Must be called inside a Dexie transaction. */
  private enqueue(operation: OutboxOperation): Promise<number> {
    const entry: OutboxEntry = {
      mutationId: generateId(),
      spreadsheetId: this.spreadsheetId,
      sheetName: this.sheetName,
      operation,
      status: 'pending',
      retries: 0,
      createdAt: new Date().toISOString(),
    }
    return db._outbox.add(entry)
  }

  /** Updates the sync store's pending count asynchronously (fire-and-forget). */
  private refreshPendingCount(): void {
    db._outbox.where('status').anyOf(['pending', 'failed']).count().then((count) => {
      useSyncStore.getState().setPendingCount(count)
    }).catch(() => {/* non-critical */})
  }
}
