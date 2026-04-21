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
import type { ILocalRepository } from './ILocalRepository'

export interface Repos {
  // Main spreadsheet (owner's personal store registry)
  stores: ILocalRepository<Record<string, unknown>>
  // Master spreadsheet
  monthlySheets: ILocalRepository<Record<string, unknown>>
  categories: ILocalRepository<Record<string, unknown>>
  products: ILocalRepository<Record<string, unknown>>
  variants: ILocalRepository<Record<string, unknown>>
  members: ILocalRepository<Record<string, unknown>>
  settings: ILocalRepository<Record<string, unknown>>
  stockLog: ILocalRepository<Record<string, unknown>>
  purchaseOrders: ILocalRepository<Record<string, unknown>>
  purchaseOrderItems: ILocalRepository<Record<string, unknown>>
  customers: ILocalRepository<Record<string, unknown>>
  auditLog: ILocalRepository<Record<string, unknown>>
  // Monthly spreadsheet
  transactions: ILocalRepository<Record<string, unknown>>
  transactionItems: ILocalRepository<Record<string, unknown>>
  refunds: ILocalRepository<Record<string, unknown>>
}
