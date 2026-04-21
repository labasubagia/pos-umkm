/**
 * db.ts — Dexie (IndexedDB) database for POS UMKM offline-first mode.
 *
 * Tables mirror the Google Sheets tab schema so the data model is identical
 * whether online or offline. Offline writes go to IndexedDB first; the
 * SyncManager drains them to Google Sheets when connectivity is restored.
 *
 * Two infrastructure tables are added:
 *   _outbox    — queued mutations awaiting sync to Sheets
 *   _syncMeta  — per-table hydration timestamps (last time pulled from Sheets)
 *
 * Only frequently-queried columns are declared as Dexie indexes.
 * All other columns are stored but unindexed (IDB stores the full object).
 *
 * Each store gets its own Dexie database (named `pos_umkm_<storeId>`) so
 * switching stores never mixes data between tenants.
 */
import Dexie, { type Table } from 'dexie'

// ─── Outbox ───────────────────────────────────────────────────────────────────

export type OutboxOperation =
  | { op: 'append'; rows: Record<string, unknown>[] }
  | { op: 'batchUpdateCells'; updates: Array<{ rowId: string; column: string; value: unknown }> }
  | { op: 'softDelete'; rowId: string }

export interface OutboxEntry {
  /** Auto-increment local PK — determines drain order (FIFO). */
  id?: number
  /** Client-generated UUID — used as idempotency key at the Sheets layer. */
  mutationId: string
  spreadsheetId: string
  sheetName: string
  operation: OutboxOperation
  status: 'pending' | 'syncing' | 'failed'
  retries: number
  createdAt: string
  errorMessage?: string
}

// ─── Sync metadata ────────────────────────────────────────────────────────────

export interface SyncMetaEntry {
  /** e.g. "Products_hydrated", "Transactions_hydrated" */
  key: string
  value: string
}

// ─── Database class ───────────────────────────────────────────────────────────

export class PosUmkmDatabase extends Dexie {
  // Main spreadsheet
  Stores!: Table<Record<string, unknown>>

  // Master spreadsheet
  Settings!: Table<Record<string, unknown>>
  Members!: Table<Record<string, unknown>>
  Categories!: Table<Record<string, unknown>>
  Products!: Table<Record<string, unknown>>
  Variants!: Table<Record<string, unknown>>
  Customers!: Table<Record<string, unknown>>
  Purchase_Orders!: Table<Record<string, unknown>>
  Purchase_Order_Items!: Table<Record<string, unknown>>
  Stock_Log!: Table<Record<string, unknown>>
  Audit_Log!: Table<Record<string, unknown>>
  Monthly_Sheets!: Table<Record<string, unknown>>

  // Monthly spreadsheet
  Transactions!: Table<Record<string, unknown>>
  Transaction_Items!: Table<Record<string, unknown>>
  Refunds!: Table<Record<string, unknown>>

  // Infrastructure tables
  _outbox!: Table<OutboxEntry>
  _syncMeta!: Table<SyncMetaEntry>

  constructor(storeId: string) {
    super(`pos_umkm_${storeId}`)

    this.version(1).stores({
      // Main spreadsheet
      Stores: 'id, store_id',

      // Master spreadsheet
      // Settings uses (id, key) — key is the lookup column for batchUpsertByKey
      Settings:             'id, key',
      Members:              'id, email',
      Categories:           'id',
      Products:             'id, category_id',
      Variants:             'id, product_id',
      Customers:            'id, phone',
      Purchase_Orders:      'id, status',
      Purchase_Order_Items: 'id, order_id, product_id',
      Stock_Log:            'id, product_id',
      Audit_Log:            'id',
      Monthly_Sheets:       'id, year_month',

      // Monthly spreadsheet
      Transactions:      'id, created_at',
      Transaction_Items: 'id, transaction_id',
      Refunds:           'id, transaction_id',

      // Infrastructure
      _outbox:   '++id, mutationId, status, sheetName',
      _syncMeta: 'key',
    })
  }
}

// ─── Per-store database factory ───────────────────────────────────────────────

const dbCache = new Map<string, PosUmkmDatabase>()

/**
 * Returns the Dexie database for the given store. Instances are cached so each
 * storeId opens exactly one connection. Database name: `pos_umkm_<storeId>`.
 */
export function getDb(storeId: string): PosUmkmDatabase {
  let instance = dbCache.get(storeId)
  if (!instance) {
    instance = new PosUmkmDatabase(storeId)
    dbCache.set(storeId, instance)
  }
  return instance
}

/**
 * Clears the factory cache. Use in tests to get a fresh database instance
 * between test cases (requires fake-indexeddb/auto at the top of the test file).
 */
export function clearDbCache(): void {
  dbCache.clear()
}

// Expose getDb for E2E Playwright tests so specs can seed IndexedDB directly
// via `page.evaluate(() => window.__getDb(storeId).Products.bulkPut([...]))`.
// Guarded by VITE_E2E so it is never present in production builds.
if (import.meta.env.VITE_E2E === 'true') {
  ;(window as unknown as Record<string, unknown>)['__getDb'] = getDb
}
