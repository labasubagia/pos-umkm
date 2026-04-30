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
  PurchaseOrderRow,
  RefundRow,
  SettingRow,
  StockLogRow,
  StoreRow,
} from "./entity-types";
import type { ILocalRepository } from "./ILocalRepository";
import type {
  IProductRepository,
  IPurchaseOrderItemRepository,
  ITransactionItemRepository,
  ITransactionRepository,
  IVariantRepository,
} from "./repo-interfaces";

export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ILocalRepository<StoreRow>;
  // Master spreadsheet
  monthlySheets: ILocalRepository<MonthlySheetRow>;
  categories: ILocalRepository<CategoryRow>;
  products: IProductRepository;
  variants: IVariantRepository;
  members: ILocalRepository<MemberRow>;
  settings: ILocalRepository<SettingRow>;
  stockLog: ILocalRepository<StockLogRow>;
  purchaseOrders: ILocalRepository<PurchaseOrderRow>;
  purchaseOrderItems: IPurchaseOrderItemRepository;
  customers: ILocalRepository<CustomerRow>;
  auditLog: ILocalRepository<AuditLogRow>;
  // Monthly spreadsheet
  transactions: ITransactionRepository;
  transactionItems: ITransactionItemRepository;
  refunds: ILocalRepository<RefundRow>;
}
