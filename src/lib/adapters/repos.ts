/**
 * repos.ts — Typed repository interface.
 *
 * Repos maps each sheet tab to a strongly-typed repository instance.
 * The actual factory (createDexieRepos) lives in adapters/index.ts.
 *
 * Sheet layout:
 *   Main spreadsheet    — Stores
 *   Master spreadsheet  — all other non-transaction tabs
 *   Monthly spreadsheet — Transactions, Transaction_Items, Refunds
 */

import type { ILocalRepository } from "./ILocalRepository";
import type {
  IProductRepository,
  IPurchaseOrderItemRepository,
  ITransactionItemRepository,
  ITransactionRepository,
  IVariantRepository,
} from "./repo-interfaces";
import type {
  AuditLog,
  Category,
  Customer,
  Member,
  MonthlySheet,
  PurchaseOrder,
  Refund,
  Setting,
  StockLog,
  Store,
} from "./zod-schemas";

export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ILocalRepository<Store>;
  // Master spreadsheet
  monthlySheets: ILocalRepository<MonthlySheet>;
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
