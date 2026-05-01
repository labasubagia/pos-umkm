/**
 * typed-repos.ts — Dexie implementations of the per-model repository interfaces.
 *
 * Each class extends DexieRepository<T> (which provides all ILocalRepository<T>
 * methods) and adds entity-specific query methods that use Dexie indexed-column
 * lookups instead of full-table scans.
 *
 * Indexed columns leveraged (declared in db.ts version(1).stores):
 *   Products             → category_id
 *   Variants             → product_id
 *   Transactions         → created_at
 *   Transaction_Items    → transaction_id
 *   Purchase_Order_Items → order_id
 */

import type {
  IProductRepository,
  IPurchaseOrderItemRepository,
  ITransactionItemRepository,
  ITransactionRepository,
  IVariantRepository,
} from "../repo-interfaces";
import type {
  Product,
  PurchaseOrderItem,
  Transaction,
  TransactionItem,
  Variant,
} from "../zod-schemas";
import { DexieRepository } from "./DexieRepository";

export class ProductRepository
  extends DexieRepository<Product>
  implements IProductRepository
{
  async findById(id: string): Promise<Product | undefined> {
    return this.db.Products.get(id);
  }
  async findByCategoryId(categoryId: string): Promise<Product[]> {
    return this.db.Products.where("category_id").equals(categoryId).toArray();
  }
}

export class VariantRepository
  extends DexieRepository<Variant>
  implements IVariantRepository
{
  async findById(id: string): Promise<Variant | undefined> {
    return this.db.Variants.get(id);
  }
  async findByProductId(productId: string): Promise<Variant[]> {
    return this.db.Variants.where("product_id").equals(productId).toArray();
  }
}

export class TransactionRepository
  extends DexieRepository<Transaction>
  implements ITransactionRepository
{
  async findById(id: string): Promise<Transaction | undefined> {
    return this.db.Transactions.get(id);
  }
  async findByDateRange(start: string, end: string): Promise<Transaction[]> {
    const endBound = `${end}T23:59:59.999Z`;
    return this.db.Transactions.where("created_at")
      .between(start, endBound, true, true)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}

export class TransactionItemRepository
  extends DexieRepository<TransactionItem>
  implements ITransactionItemRepository
{
  async findByTransactionId(transactionId: string): Promise<TransactionItem[]> {
    return this.db.Transaction_Items.where("transaction_id")
      .equals(transactionId)
      .toArray();
  }
}

export class PurchaseOrderItemRepository
  extends DexieRepository<PurchaseOrderItem>
  implements IPurchaseOrderItemRepository
{
  async findByOrderId(orderId: string): Promise<PurchaseOrderItem[]> {
    return this.db.Purchase_Order_Items.where("order_id")
      .equals(orderId)
      .toArray();
  }
}
