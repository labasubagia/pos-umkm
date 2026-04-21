/**
 * DexieRepository.ts — ILocalRepository backed by IndexedDB (Dexie).
 *
 * Serves reads from IndexedDB (instant, offline-capable) and queues writes to
 * the _outbox table for later sync to Google Sheets by SyncManager.
 *
 * The `syncTarget` constructor argument is an outbox routing hint only — it
 * tells SyncManager which spreadsheet/sheet to replay the operation against.
 * It carries no semantic claim that this repository "is" a sheet.
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
import type { ILocalRepository } from '../ILocalRepository'
import type { PosUmkmDatabase } from './db'
import type { OutboxEntry, OutboxOperation } from './db'
import { generateId } from '../../uuid'
import { useSyncStore } from '../../../store/syncStore'

export interface SyncTarget {
  spreadsheetId: string
  sheetName: string
}

export class DexieRepository<T extends Record<string, unknown>>
  implements ILocalRepository<T> {
  private readonly db: PosUmkmDatabase
  private readonly syncTarget: SyncTarget

  constructor(db: PosUmkmDatabase, syncTarget: SyncTarget) {
    this.db = db
    this.syncTarget = syncTarget
  }

  // ─── Reads (always from IndexedDB) ──────────────────────────────────────────

  async getAll(): Promise<T[]> {
    const rows = await this.db.table<T>(this.syncTarget.sheetName).toArray()
    return rows.filter((r) => !(r as Record<string, unknown>)['deleted_at'])
  }

  // ─── Writes (IndexedDB + outbox) ─────────────────────────────────────────────

  async batchInsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return
    const rowsWithIds = rows.map((r) =>
      r['id'] ? r : { id: generateId(), ...r },
    )
    const tableName = this.syncTarget.sheetName
    await this.db.transaction('rw', [this.db.table(tableName), this.db._outbox], async () => {
      await this.db.table(tableName).bulkPut(rowsWithIds)
      await this.enqueue({ op: 'append', rows: rowsWithIds as Record<string, unknown>[] })
    })
    this.refreshPendingCount()
  }

  async batchUpdate(
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void> {
    if (updates.length === 0) return
    const tableName = this.syncTarget.sheetName
    await this.db.transaction('rw', [this.db.table(tableName), this.db._outbox], async () => {
      for (const { rowId, column, value } of updates) {
        const existing = await this.db.table(tableName).get(rowId)
        if (!existing) continue // row not locally cached yet — skip local update
        await this.db.table(tableName).update(rowId, { [column]: value })
      }
      await this.enqueue({ op: 'batchUpdateCells', updates })
    })
    this.refreshPendingCount()
  }

  /**
   * Decomposes batchUpsertBy into primitives (batchInsert + batchUpdate) that
   * are individually outbox-able. Uses per-entry indexed lookups instead of
   * loading the full table into memory, avoiding memory spikes on large tables.
   */
  async batchUpsertBy(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    if (entries.length === 0) return

    const tableName = this.syncTarget.sheetName
    const existingRows = await Promise.all(
      entries.map(({ lookupValue }) =>
        this.db.table<Record<string, unknown>>(tableName)
          .where(lookupColumn).equals(lookupValue)
          .first(),
      ),
    )

    const updates: Array<{ rowId: string; column: string; value: unknown }> = []
    const newRows: Record<string, unknown>[] = []

    for (let i = 0; i < entries.length; i++) {
      const { lookupValue, value } = entries[i]
      const existing = existingRows[i]
      if (existing) {
        updates.push({ rowId: existing['id'] as string, column: updateColumn, value })
      } else {
        newRows.push(makeNewRow(lookupValue, value))
      }
    }

    if (updates.length > 0) await this.batchUpdate(updates)
    if (newRows.length > 0) await this.batchInsert(newRows as Array<Partial<T> & Record<string, unknown>>)
  }

  async softDelete(rowId: string): Promise<void> {
    const deletedAt = new Date().toISOString()
    const tableName = this.syncTarget.sheetName
    await this.db.transaction('rw', [this.db.table(tableName), this.db._outbox], async () => {
      await this.db.table(tableName).update(rowId, { deleted_at: deletedAt })
      await this.enqueue({ op: 'softDelete', rowId })
    })
    this.refreshPendingCount()
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private enqueue(operation: OutboxOperation): Promise<number> {
    const entry: OutboxEntry = {
      mutationId: generateId(),
      spreadsheetId: this.syncTarget.spreadsheetId,
      sheetName: this.syncTarget.sheetName,
      operation,
      status: 'pending',
      retries: 0,
      createdAt: new Date().toISOString(),
    }
    return this.db._outbox.add(entry)
  }

  private refreshPendingCount(): void {
    this.db._outbox.where('status').anyOf(['pending', 'failed']).count().then((count) => {
      useSyncStore.getState().setPendingCount(count)
    }).catch(() => {/* non-critical */})
  }
}
