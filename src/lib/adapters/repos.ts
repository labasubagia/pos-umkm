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
import type {
  AuditLogRow,
  CategoryRow,
  CustomerRow,
  MemberRow,
  MonthlySheetRow,
  ProductRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  RefundRow,
  SettingRow,
  StockLogRow,
  StoreRow,
  TransactionItemRow,
  TransactionRow,
  VariantRow,
} from "./entity-types";
import type { ILocalRepository } from "./ILocalRepository";

export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ILocalRepository<StoreRow>;
  // Master spreadsheet
  monthlySheets: ILocalRepository<MonthlySheetRow>;
  categories: ILocalRepository<CategoryRow>;
  products: ILocalRepository<ProductRow>;
  variants: ILocalRepository<VariantRow>;
  members: ILocalRepository<MemberRow>;
  settings: ILocalRepository<SettingRow>;
  stockLog: ILocalRepository<StockLogRow>;
  purchaseOrders: ILocalRepository<PurchaseOrderRow>;
  purchaseOrderItems: ILocalRepository<PurchaseOrderItemRow>;
  customers: ILocalRepository<CustomerRow>;
  auditLog: ILocalRepository<AuditLogRow>;
  // Monthly spreadsheet
  transactions: ILocalRepository<TransactionRow>;
  transactionItems: ILocalRepository<TransactionItemRow>;
  refunds: ILocalRepository<RefundRow>;
}
