/**
 * repo-interfaces.ts — Per-model repository interfaces (Option B).
 *
 * Extends ILocalRepository<T> with entity-specific query methods that map
 * directly to Dexie indexed-column lookups. Only entities with meaningful
 * query patterns get a dedicated interface; the rest stay ILocalRepository<T>.
 *
 * Covered entities:
 *   IProductRepository          — findById, findByCategoryId
 *   IVariantRepository          — findById, findByProductId
 *   ITransactionRepository      — findById, findByDateRange
 *   ITransactionItemRepository  — findByTransactionId
 *   IPurchaseOrderItemRepository — findByOrderId
 */
import type {
  ProductRow,
  PurchaseOrderItemRow,
  TransactionItemRow,
  TransactionRow,
  VariantRow,
} from "./entity-types";
import type { ILocalRepository } from "./ILocalRepository";

// ─── Products ────────────────────────────────────────────────────────────────

export interface IProductRepository extends ILocalRepository<ProductRow> {
  /**
   * Returns the product with the given id, or undefined if not found or
   * soft-deleted.
   */
  findById(id: string): Promise<ProductRow | undefined>;

  /**
   * Returns all non-deleted products belonging to a category.
   * Uses the `category_id` Dexie index — O(k) not O(n).
   */
  findByCategoryId(categoryId: string): Promise<ProductRow[]>;
}

// ─── Variants ────────────────────────────────────────────────────────────────

export interface IVariantRepository extends ILocalRepository<VariantRow> {
  /**
   * Returns the variant with the given id, or undefined if not found or
   * soft-deleted.
   */
  findById(id: string): Promise<VariantRow | undefined>;

  /**
   * Returns all non-deleted variants belonging to a product.
   * Uses the `product_id` Dexie index — O(k) not O(n).
   */
  findByProductId(productId: string): Promise<VariantRow[]>;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface ITransactionRepository
  extends ILocalRepository<TransactionRow> {
  /**
   * Returns the transaction with the given id, or undefined if not found.
   */
  findById(id: string): Promise<TransactionRow | undefined>;

  /**
   * Returns all transactions whose `created_at` falls within [startDate, endDate].
   * Both bounds are ISO 8601 date strings (YYYY-MM-DD); endDate is end-of-day
   * inclusive (23:59:59.999Z).
   * Uses the `created_at` Dexie index — O(k) not O(n).
   */
  findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<TransactionRow[]>;
}

// ─── Transaction Items ────────────────────────────────────────────────────────

export interface ITransactionItemRepository
  extends ILocalRepository<TransactionItemRow> {
  /**
   * Returns all items belonging to a transaction.
   * Uses the `transaction_id` Dexie index — O(k) not O(n).
   */
  findByTransactionId(transactionId: string): Promise<TransactionItemRow[]>;
}

// ─── Purchase Order Items ─────────────────────────────────────────────────────

export interface IPurchaseOrderItemRepository
  extends ILocalRepository<PurchaseOrderItemRow> {
  /**
   * Returns all items belonging to a purchase order.
   * Uses the `order_id` Dexie index — O(k) not O(n).
   */
  findByOrderId(orderId: string): Promise<PurchaseOrderItemRow[]>;
}
