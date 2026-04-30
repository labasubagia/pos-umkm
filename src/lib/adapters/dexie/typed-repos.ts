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
  ProductRow,
  PurchaseOrderItemRow,
  TransactionItemRow,
  TransactionRow,
  VariantRow,
} from "../entity-types";
import type {
  IProductRepository,
  IPurchaseOrderItemRepository,
  ITransactionItemRepository,
  ITransactionRepository,
  IVariantRepository,
} from "../repo-interfaces";
import { DexieRepository, type SyncTarget } from "./DexieRepository";
import type { PosUmkmDatabase } from "./db";

// ─── Products ─────────────────────────────────────────────────────────────────

export class DexieProductRepository
  extends DexieRepository<ProductRow>
  implements IProductRepository
{
  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite?: () => void,
  ) {
    super(db, syncTarget, onAfterWrite);
  }

  async findById(id: string): Promise<ProductRow | undefined> {
    const row = await this.db.Products.get(id);
    if (!row || row.deleted_at) return undefined;
    return row;
  }

  async findByCategoryId(categoryId: string): Promise<ProductRow[]> {
    return this.db.Products.where("category_id")
      .equals(categoryId)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export class DexieVariantRepository
  extends DexieRepository<VariantRow>
  implements IVariantRepository
{
  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite?: () => void,
  ) {
    super(db, syncTarget, onAfterWrite);
  }

  async findById(id: string): Promise<VariantRow | undefined> {
    const row = await this.db.Variants.get(id);
    if (!row || row.deleted_at) return undefined;
    return row;
  }

  async findByProductId(productId: string): Promise<VariantRow[]> {
    return this.db.Variants.where("product_id")
      .equals(productId)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export class DexieTransactionRepository
  extends DexieRepository<TransactionRow>
  implements ITransactionRepository
{
  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite?: () => void,
  ) {
    super(db, syncTarget, onAfterWrite);
  }

  async findById(id: string): Promise<TransactionRow | undefined> {
    const row = await this.db.Transactions.get(id);
    if (!row || row.deleted_at) return undefined;
    return row;
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<TransactionRow[]> {
    const endBound = `${endDate}T23:59:59.999Z`;
    return this.db.Transactions.where("created_at")
      .between(startDate, endBound, true, true)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}

// ─── Transaction Items ────────────────────────────────────────────────────────

export class DexieTransactionItemRepository
  extends DexieRepository<TransactionItemRow>
  implements ITransactionItemRepository
{
  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite?: () => void,
  ) {
    super(db, syncTarget, onAfterWrite);
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionItemRow[]> {
    return this.db.Transaction_Items.where("transaction_id")
      .equals(transactionId)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}

// ─── Purchase Order Items ─────────────────────────────────────────────────────

export class DexiePurchaseOrderItemRepository
  extends DexieRepository<PurchaseOrderItemRow>
  implements IPurchaseOrderItemRepository
{
  constructor(
    db: PosUmkmDatabase,
    syncTarget: SyncTarget,
    onAfterWrite?: () => void,
  ) {
    super(db, syncTarget, onAfterWrite);
  }

  async findByOrderId(orderId: string): Promise<PurchaseOrderItemRow[]> {
    return this.db.Purchase_Order_Items.where("order_id")
      .equals(orderId)
      .filter((r) => !r.deleted_at)
      .toArray();
  }
}
