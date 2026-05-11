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
import Dexie, { type Table } from "dexie";
import type {
  AuditLog,
  Category,
  Customer,
  Member,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Refund,
  Setting,
  StockLog,
  Store,
  Transaction,
  TransactionItem,
  Variant,
} from "../zod-schemas";

// ─── Outbox ───────────────────────────────────────────────────────────────────

export type OutboxOperation =
  | { op: "batchInsert"; items: Record<string, unknown>[] }
  | { op: "batchUpdate"; items: Record<string, unknown>[] }
  | { op: "softDelete"; id: string };

export interface OutboxEntry {
  /** Auto-increment local PK — determines drain order (FIFO). */
  id?: number;
  /** Client-generated UUID — used as idempotency key at the Sheets layer. */
  mutationId: string;
  tableName: string;
  operation: OutboxOperation;
  status: "pending" | "syncing" | "failed";
  retries: number;
  createdAt: string;
  errorMessage?: string;
}

// ─── Sync metadata ────────────────────────────────────────────────────────────

export interface SyncMetaEntry {
  /** e.g. "Products_hydrated", "Transactions_hydrated" */
  key: string;
  value: string;
}

// ─── Database class ───────────────────────────────────────────────────────────

export class Database extends Dexie {
  // Main spreadsheet
  Stores!: Table<Store>;

  // Master spreadsheet
  Settings!: Table<Setting>;
  Members!: Table<Member>;
  Categories!: Table<Category>;
  Products!: Table<Product>;
  Variants!: Table<Variant>;
  Customers!: Table<Customer>;
  Purchase_Orders!: Table<PurchaseOrder>;
  Purchase_Order_Items!: Table<PurchaseOrderItem>;
  Stock_Log!: Table<StockLog>;
  Audit_Log!: Table<AuditLog>;

  // Monthly spreadsheet
  Transactions!: Table<Transaction>;
  Transaction_Items!: Table<TransactionItem>;
  Refunds!: Table<Refund>;

  // Infrastructure tables
  _outbox!: Table<OutboxEntry>;
  _syncMeta!: Table<SyncMetaEntry>;

  constructor(storeId: string) {
    super(`pos_umkm_${storeId}`);

    this.version(1).stores({
      // Main spreadsheet
      Stores: "id, store_id",

      // Master spreadsheet
      // Settings uses (id, key) — key is the lookup column for batchUpsertByKey
      Settings: "id, key",
      Members: "id, email",
      Categories: "id",
      Products: "id, category_id",
      Variants: "id, product_id",
      Customers: "id, phone",
      Purchase_Orders: "id, status",
      Purchase_Order_Items: "id, order_id, product_id",
      Stock_Log: "id, product_id",
      Audit_Log: "id",

      // Monthly spreadsheet
      Transactions: "id, created_at",
      Transaction_Items: "id, transaction_id",
      Refunds: "id, transaction_id",

      // Infrastructure
      _outbox: "++id, mutationId, status, tableName",
      _syncMeta: "key",
    });
  }
}

// ─── Per-store database factory ───────────────────────────────────────────────

const DB_NAME_PREFIX = "pos_umkm_";
const dbCache = new Map<string, Database>();

/**
 * Returns the Dexie database for the given store. Instances are cached so each
 * storeId opens exactly one connection. Database name: `pos_umkm_<storeId>`.
 */
export function getDb(storeId: string): Database {
  let instance = dbCache.get(storeId);
  if (!instance) {
    instance = new Database(storeId);
    dbCache.set(storeId, instance);
  }
  return instance;
}

async function listPosUmkmDatabaseNames(): Promise<string[]> {
  const names = new Set<string>();

  for (const db of dbCache.values()) {
    names.add(db.name);
  }

  const indexedDbFactory = globalThis.indexedDB as
    | (IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
      })
    | undefined;

  if (indexedDbFactory?.databases) {
    const databases = await indexedDbFactory.databases();
    for (const database of databases) {
      if (database.name?.startsWith(DB_NAME_PREFIX)) {
        names.add(database.name);
      }
    }
  }

  return [...names].filter((name) => name.startsWith(DB_NAME_PREFIX));
}

/**
 * Deletes every POS UMKM Dexie database from IndexedDB.
 * Used on logout so the next session starts from a clean local cache.
 */
export async function deletePosUmkmDatabases(): Promise<string[]> {
  const dbNames = await listPosUmkmDatabaseNames();

  for (const db of dbCache.values()) {
    db.close();
  }
  dbCache.clear();

  await Promise.all(dbNames.map((dbName) => Dexie.delete(dbName)));
  return dbNames;
}

/**
 * Clears the factory cache. Use in tests to get a fresh database instance
 * between test cases (requires fake-indexeddb/auto at the top of the test file).
 */
export function clearDbCache(): void {
  for (const db of dbCache.values()) {
    db.close();
  }
  dbCache.clear();
}
