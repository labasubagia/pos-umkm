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
  getAll(): Promise<T[]>;

  /** Insert rows into IndexedDB and queue outbox entries for remote sync. */
  batchInsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;

  /**
   * Patch records in IndexedDB by id. Each row must contain `id` plus the
   * fields to update. Only the provided fields are changed.
   */
  batchUpdate(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;

  /**
   * Insert-or-update records by `id`. Each row must contain `id`.
   * Rows whose `id` already exists are updated; the rest are inserted.
   */
  batchUpsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;

  /** Stamp `deleted_at` on a record and queue an outbox entry for remote sync. */
  softDelete(id: string): Promise<void>;
}
