/**
 * ILocalRepository<T> — interface for browser-local data access via IndexedDB.
 *
 * This is the interface feature modules use via getRepos(). It describes
 * local data operations — not Google Sheets API calls.
 *
 * ISheetRepository<T> (in SheetRepository.ts) is the remote sync interface,
 * used only by SheetRepository, SyncManager, HydrationService, and makeRepo().
 */
export interface ILocalRepository<T extends Record<string, unknown>> {
  /** Read all non-deleted rows from the local IndexedDB table. */
  getAll(): Promise<T[]>

  /** Insert rows into IndexedDB and queue outbox entries for remote sync. */
  batchInsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>

  /**
   * Patch specific columns on specific rows in IndexedDB and queue outbox
   * entries for remote sync.
   */
  batchUpdate(updates: Array<{ rowId: string; column: string; value: unknown }>): Promise<void>

  /**
   * For each entry: update `updateColumn` if a row matching `lookupColumn =
   * lookupValue` already exists; otherwise insert a new row via `makeNewRow`.
   * Decomposes into batchInsert + batchUpdate so each part is individually
   * outbox-able without serialising `makeNewRow`.
   */
  batchUpsertBy(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void>

  /** Stamp `deleted_at` on a row and queue an outbox entry for remote sync. */
  softDelete(rowId: string): Promise<void>
}
