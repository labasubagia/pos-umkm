/**
 * repos.ts — Typed repository factory.
 *
 * Repos maps each sheet tab to a strongly-typed repository instance.
 * Use createGoogleRepos() for production and createMockRepos() for dev/test.
 *
 * Sheet layout:
 *   Main spreadsheet  — Stores
 *   Master spreadsheet — all other non-transaction tabs
 *   Monthly spreadsheet — Transactions, Transaction_Items, Refunds
 */
import { SheetRepository, type ISheetRepository } from './SheetRepository'
import { MockSheetRepository } from './MockSheetRepository'
import { ALL_TAB_HEADERS } from '../schema'

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

export function createGoogleRepos(
  mainId: string,
  masterId: string,
  monthlyId: string,
  getToken: () => string,
): Repos {
  const r = (spreadsheetId: string, sheetName: string) =>
    new SheetRepository(spreadsheetId, sheetName, getToken, ALL_TAB_HEADERS[sheetName])
  return {
    stores:             r(mainId,    'Stores'),
    monthlySheets:      r(masterId,  'Monthly_Sheets'),
    categories:         r(masterId,  'Categories'),
    products:           r(masterId,  'Products'),
    variants:           r(masterId,  'Variants'),
    members:            r(masterId,  'Members'),
    settings:           r(masterId,  'Settings'),
    stockLog:           r(masterId,  'Stock_Log'),
    purchaseOrders:     r(masterId,  'Purchase_Orders'),
    purchaseOrderItems: r(masterId,  'Purchase_Order_Items'),
    customers:          r(masterId,  'Customers'),
    auditLog:           r(masterId,  'Audit_Log'),
    transactions:       r(monthlyId, 'Transactions'),
    transactionItems:   r(monthlyId, 'Transaction_Items'),
    refunds:            r(monthlyId, 'Refunds'),
  }
}

export function createMockRepos(): Repos {
  const m = (sheetName: string) => new MockSheetRepository(sheetName)
  return {
    stores:             m('Stores'),
    monthlySheets:      m('Monthly_Sheets'),
    categories:         m('Categories'),
    products:           m('Products'),
    variants:           m('Variants'),
    members:            m('Members'),
    settings:           m('Settings'),
    stockLog:           m('Stock_Log'),
    purchaseOrders:     m('Purchase_Orders'),
    purchaseOrderItems: m('Purchase_Order_Items'),
    customers:          m('Customers'),
    auditLog:           m('Audit_Log'),
    transactions:       m('Transactions'),
    transactionItems:   m('Transaction_Items'),
    refunds:            m('Refunds'),
  }
}
