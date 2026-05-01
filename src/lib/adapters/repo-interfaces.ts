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

import type { ILocalRepository } from "./ILocalRepository";
import type {
  Product,
  PurchaseOrderItem,
  Transaction,
  TransactionItem,
  Variant,
} from "./zod-schemas";

// ─── Products ────────────────────────────────────────────────────────────────

export interface IProductRepository extends ILocalRepository<Product> {
  /**
   * Returns the product with the given id, or undefined if not found or
   * soft-deleted.
   */
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
