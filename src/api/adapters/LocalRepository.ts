/**
 * LocalRepository.ts — Repository interfaces for browser-local data access via IndexedDB.
 *
 * This file contains:
 *   - ILocalRepository<T>: base interface for local data operations
 *   - Entity-specific repository interfaces: IProductRepository, IVariantRepository, etc.
 *   - Repos: aggregate type mapping each sheet tab to its repository type
 *
 * ISheetRepository<T> (in SheetRepository.ts) is the remote sync interface,
 * used only by SheetRepository, SyncManager, HydrationService, and makeRepo().
 */
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
} from "./zod-schemas";

/**
 * ILocalRepository<T> — interface for browser-local data access via IndexedDB.
 *
 * This is the interface feature modules use via getRepos(). It describes
 * local data operations — not Google Sheets API calls.
 */
export interface ILocalRepository<T extends Record<string, unknown>> {
  /** Read all non-deleted payload from the local IndexedDB table. */
  getAll(): Promise<T[]>;

  /** Insert payload into IndexedDB and queue outbox entries for remote sync. */
  batchInsert(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void>;

  /**
   * Patch records in IndexedDB by id. Each payload must contain `id` plus the
   * fields to update. Only the provided fields are changed.
   */
  batchUpdate(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void>;

  /**
   * Insert-or-update records by `id`. Each payload must contain `id`.
   * Payload whose `id` already exists are updated; the rest are inserted.
   */
  batchUpsert(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void>;

  /** Stamp `deleted_at` on a record and queue an outbox entry for remote sync. */
  softDelete(id: string): Promise<void>;
}

// ─── Per-model repository interfaces ────────────────────────────────────────────

export interface IProductRepository extends ILocalRepository<Product> {
  /** Returns the product with the given id, or undefined if not found or soft-deleted. */
  findById(id: string): Promise<Product | undefined>;
  findByCategoryId(categoryId: string): Promise<Product[]>;
}

export interface IVariantRepository extends ILocalRepository<Variant> {
  findById(id: string): Promise<Variant | undefined>;
  findByProductId(productId: string): Promise<Variant[]>;
}

export interface ITransactionRepository extends ILocalRepository<Transaction> {
  findById(id: string): Promise<Transaction | undefined>;
  findByDateRange(start: string, end: string): Promise<Transaction[]>;
}

export interface ITransactionItemRepository
  extends ILocalRepository<TransactionItem> {
  findByTransactionId(transactionId: string): Promise<TransactionItem[]>;
}

export interface IPurchaseOrderItemRepository
  extends ILocalRepository<PurchaseOrderItem> {
  findByOrderId(orderId: string): Promise<PurchaseOrderItem[]>;
}

// ─── Aggregate repository type ────────────────────────────────────────────────

/**
 * Repos maps each sheet tab to a strongly-typed repository instance.
 * The actual factory (createDexieRepos) lives in adapters/index.ts.
 *
 * Sheet layout:
 *   Main spreadsheet    — Stores
 *   Master spreadsheet  — all other non-transaction tabs
 *   Monthly spreadsheet — Transactions, Transaction_Items, Refunds
 */
export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ILocalRepository<Store>;
  // Master spreadsheet
  categories: ILocalRepository<Category>;
  products: IProductRepository;
  variants: IVariantRepository;
  members: ILocalRepository<Member>;
  settings: ILocalRepository<Setting>;
  stockLog: ILocalRepository<StockLog>;
  purchaseOrders: ILocalRepository<PurchaseOrder>;
  purchaseOrderItems: IPurchaseOrderItemRepository;
  customers: ILocalRepository<Customer>;
  auditLog: ILocalRepository<AuditLog>;
  // Monthly spreadsheet
  transactions: ITransactionRepository;
  transactionItems: ITransactionItemRepository;
  refunds: ILocalRepository<Refund>;
}
