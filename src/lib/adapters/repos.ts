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
import type { ISheetRepository } from './SheetRepository'

export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ISheetRepository<Record<string, unknown>>
  // Master spreadsheet
  monthlySheets: ISheetRepository<Record<string, unknown>>
  categories: ISheetRepository<Record<string, unknown>>
  products: ISheetRepository<Record<string, unknown>>
  variants: ISheetRepository<Record<string, unknown>>
  members: ISheetRepository<Record<string, unknown>>
  settings: ISheetRepository<Record<string, unknown>>
  stockLog: ISheetRepository<Record<string, unknown>>
  purchaseOrders: ISheetRepository<Record<string, unknown>>
  purchaseOrderItems: ISheetRepository<Record<string, unknown>>
  customers: ISheetRepository<Record<string, unknown>>
  auditLog: ISheetRepository<Record<string, unknown>>
  // Monthly spreadsheet
  transactions: ISheetRepository<Record<string, unknown>>
  transactionItems: ISheetRepository<Record<string, unknown>>
  refunds: ISheetRepository<Record<string, unknown>>
}
