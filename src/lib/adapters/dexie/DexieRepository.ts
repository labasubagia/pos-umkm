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
  private readonly onAfterWrite: () => void

  constructor(db: PosUmkmDatabase, syncTarget: SyncTarget, onAfterWrite: () => void = () => {}) {
    this.db = db
    this.syncTarget = syncTarget
    this.onAfterWrite = onAfterWrite
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
    this.onAfterWrite()
  }

  async batchUpdate(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return
    const tableName = this.syncTarget.sheetName
    await this.db.transaction('rw', [this.db.table(tableName), this.db._outbox], async () => {
      for (const row of rows) {
        const { id, ...fields } = row
        if (!id) continue
        const existing = await this.db.table(tableName).get(id as string)
        if (!existing) continue // row not locally cached yet — skip local update
        await this.db.table(tableName).update(id as string, fields)
      }
      // Translate to outbox vocabulary for SyncManager compatibility
      const updates = rows.flatMap(({ id, ...fields }) =>
        Object.entries(fields).map(([column, value]) => ({ rowId: id as string, column, value })),
      )
      await this.enqueue({ op: 'batchUpdateCells', updates })
    })
    this.refreshPendingCount()
    this.onAfterWrite()
  }

  /**
   * Insert-or-update rows by `id`. Checks which IDs exist in the local table,
   * routes existing rows to batchUpdate and new rows to batchInsert so each
   * part gets the correct outbox operation type.
   */
  async batchUpsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return
    const tableName = this.syncTarget.sheetName

    const existingSet = new Set(
      (await Promise.all(
        rows.map((r) => this.db.table(tableName).get(r['id'] as string)),
      ))
        .map((r, i) => (r ? rows[i]['id'] as string : null))
        .filter((id): id is string => id !== null),
    )

    const toUpdate = rows.filter((r) => existingSet.has(r['id'] as string))
    const toInsert = rows.filter((r) => !existingSet.has(r['id'] as string))

    if (toUpdate.length > 0) await this.batchUpdate(toUpdate)
    if (toInsert.length > 0) await this.batchInsert(toInsert)
  }

  async softDelete(id: string): Promise<void> {
    const deletedAt = new Date().toISOString()
    const tableName = this.syncTarget.sheetName
    await this.db.transaction('rw', [this.db.table(tableName), this.db._outbox], async () => {
      await this.db.table(tableName).update(id, { deleted_at: deletedAt })
      await this.enqueue({ op: 'softDelete', rowId: id })
    })
    this.refreshPendingCount()
    this.onAfterWrite()
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
