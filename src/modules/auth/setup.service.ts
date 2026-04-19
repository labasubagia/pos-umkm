/**
 * setup.service.ts — Owner first-time setup and monthly sheet management.
 *
 * Responsible for:
 * 1. Creating the Master Spreadsheet (once, on first login).
 * 2. Initializing all required tab headers in the Master Sheet.
 * 3. Managing monthly transaction spreadsheets (lazy creation on first tx).
 *
 * Uses the active DataAdapter so these calls work with both Mock and Google
 * adapters — no direct Sheets API calls from this file.
 */

import { dataAdapter } from '../../lib/adapters'

/** All tab names that must exist in the Master Spreadsheet. */
export const MASTER_TABS = [
  'Settings',
  'Users',
  'Categories',
  'Products',
  'Variants',
  'Customers',
  'Purchase_Orders',
  'Purchase_Order_Items',
  'Stock_Log',
  'Audit_Log',
] as const

/** All tab names that must exist in each Monthly Spreadsheet. */
export const MONTHLY_TABS = ['Transactions', 'Transaction_Items', 'Refunds'] as const

/**
 * Column headers for each Master Sheet tab.
 * These must match the keys written by the corresponding service's appendRow calls
 * so that GoogleDataAdapter can map object keys to the correct column positions.
 */
export const MASTER_TAB_HEADERS: Record<string, string[]> = {
  Settings: ['id', 'key', 'value', 'updated_at'],
  Users: ['id', 'email', 'name', 'role', 'invited_at', 'deleted_at'],
  Categories: ['id', 'name', 'created_at', 'deleted_at'],
  Products: ['id', 'category_id', 'name', 'sku', 'price', 'stock', 'has_variants', 'created_at', 'deleted_at'],
  Variants: ['id', 'product_id', 'option_name', 'option_value', 'price', 'stock', 'created_at', 'deleted_at'],
  Customers: ['id', 'name', 'phone', 'email', 'created_at', 'deleted_at'],
  Purchase_Orders: ['id', 'supplier', 'status', 'created_at', 'deleted_at'],
  Purchase_Order_Items: ['id', 'order_id', 'product_id', 'product_name', 'qty', 'cost_price', 'created_at'],
  Stock_Log: ['id', 'product_id', 'reason', 'qty_before', 'qty_after', 'created_at'],
  Audit_Log: ['id', 'event', 'data', 'created_at'],
}

/**
 * Column headers for each Monthly Sheet tab.
 */
export const MONTHLY_TAB_HEADERS: Record<string, string[]> = {
  Transactions: [
    'id', 'created_at', 'cashier_id', 'customer_id',
    'subtotal', 'discount_type', 'discount_value', 'discount_amount',
    'tax', 'total', 'payment_method', 'cash_received', 'change',
    'receipt_number', 'notes',
  ],
  Transaction_Items: [
    'id', 'transaction_id', 'product_id', 'variant_id',
    'name', 'price', 'quantity', 'subtotal',
  ],
  Refunds: [
    'id', 'transaction_id', 'product_id', 'product_name',
    'qty', 'unit_price', 'reason', 'created_at',
  ],
}

/** localStorage key pattern for monthly sheets. */
function monthKey(year: number, month: number): string {
  const mm = String(month).padStart(2, '0')
  return `txSheet_${year}-${mm}`
}

/** Custom error for setup failures. */
export class SetupError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'SetupError'
    this.cause = cause
  }
}

// ─── T015 ─────────────────────────────────────────────────────────────────────

/**
 * Creates the Master Spreadsheet inside `apps/pos_umkm/<businessName>/` in the
 * owner's Google Drive. Uses `drive.file` scope — called once on first login.
 * Updates the adapter's active spreadsheetId immediately so subsequent calls work.
 * Returns the new spreadsheetId.
 */
export async function createMasterSpreadsheet(businessName: string): Promise<string> {
  try {
    const name = `POS UMKM — Master — ${businessName}`

    let parentFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const folderId = await dataAdapter.ensureFolder(['apps', 'pos_umkm', businessName])
      if (folderId) {
        parentFolderId = folderId
        // Persist folder ID and store name so monthly sheets know their folder path.
        localStorage.setItem('storeFolderId', folderId)
        localStorage.setItem('storeName', businessName)
      }
    }

    const id = await dataAdapter.createSpreadsheet(name, parentFolderId, [...MASTER_TABS])
    dataAdapter.setSpreadsheetId(id)
    return id
  } catch (err) {
    throw new SetupError(`createMasterSpreadsheet failed: ${String(err)}`, err)
  }
}

/**
 * Writes the column header row to every tab of the Master Spreadsheet.
 * Must be called once after createMasterSpreadsheet so that GoogleDataAdapter
 * can map object keys to the correct column positions in subsequent appendRow calls.
 * In MockDataAdapter this is a no-op — the mock uses object keys directly.
 */
export async function initializeMasterSheets(spreadsheetId: string): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError('initializeMasterSheets: spreadsheetId is required')
  }
  // Ensure the adapter targets the correct spreadsheet before writing.
  dataAdapter.setSpreadsheetId(spreadsheetId)
  // Write one header row per tab concurrently.
  await Promise.all(
    MASTER_TABS.map((tab) =>
      dataAdapter.writeHeaders(tab, MASTER_TAB_HEADERS[tab] ?? []),
    ),
  )
}

/**
 * Persists the master spreadsheetId to localStorage under the canonical key.
 * The spreadsheetId is not sensitive (it's a public file identifier), so
 * localStorage is the right storage tier — it survives page refreshes.
 */
export function saveSpreadsheetId(spreadsheetId: string): void {
  localStorage.setItem('masterSpreadsheetId', spreadsheetId)
}

// ─── T016 ─────────────────────────────────────────────────────────────────────

/**
 * Returns the spreadsheetId for the current calendar month's transaction sheet.
 * Returns null if the sheet has not been created yet (triggers lazy creation
 * on the first transaction of the month).
 */
export function getCurrentMonthSheetId(): string | null {
  const now = new Date()
  const key = monthKey(now.getFullYear(), now.getMonth() + 1)
  return localStorage.getItem(key)
}

/**
 * Creates a new monthly transaction spreadsheet.
 * Named "POS UMKM — Transactions — YYYY-MM".
 * The spreadsheetId is persisted to localStorage keyed by "txSheet_YYYY-MM".
 */
/**
 * Creates a new monthly transaction spreadsheet.
 * Named "POS UMKM — Transactions — YYYY-MM".
 * Placed in apps/pos_umkm/<Store Name>/transactions/<Year>/<Month>/ in Drive.
 * The spreadsheetId is persisted to localStorage keyed by "txSheet_YYYY-MM".
 */
export async function createMonthlySheet(year: number, month: number): Promise<string> {
  try {
    const mm = String(month).padStart(2, '0')
    const name = `POS UMKM — Transactions — ${year}-${mm}`

    let parentFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const storeName = localStorage.getItem('storeName')
      if (storeName) {
        // Place sheet in apps/pos_umkm/<Store Name>/transactions/<Year>/<Month>/
        const folderId = await dataAdapter.ensureFolder([
          'apps', 'pos_umkm', storeName, 'transactions', String(year), mm,
        ])
        if (folderId) parentFolderId = folderId
      } else {
        // Fallback: use the store folder directly (pre-existing sessions without storeName)
        parentFolderId = localStorage.getItem('storeFolderId') ?? undefined
      }
    }

    const id = await dataAdapter.createSpreadsheet(name, parentFolderId, [...MONTHLY_TABS])
    localStorage.setItem(monthKey(year, month), id)
    return id
  } catch (err) {
    throw new SetupError(`createMonthlySheet failed: ${String(err)}`, err)
  }
}

/**
 * Writes the column header row to every tab of a Monthly Spreadsheet.
 * Must be called after setMonthlySpreadsheetId(id) so that writeHeaders
 * routes to the monthly spreadsheet and not the master.
 * In MockDataAdapter this is a no-op.
 */
export async function initializeMonthlySheets(spreadsheetId: string): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError('initializeMonthlySheets: spreadsheetId is required')
  }
  await Promise.all(
    MONTHLY_TABS.map((tab) =>
      dataAdapter.writeHeaders(tab, MONTHLY_TAB_HEADERS[tab] ?? []),
    ),
  )
}

/**
 * Shares the given spreadsheet with all active members listed in the Users tab.
 * Active members are rows where deleted_at is falsy.
 * Called after creating a new monthly sheet so all members can access it.
 */
export async function shareSheetWithAllMembers(spreadsheetId: string): Promise<void> {
  const users = await dataAdapter.getSheet('Users')
  const activeMembers = users.filter(
    (u) => !u['deleted_at'] && u['email'] && u['email'] !== '',
  )
  await Promise.all(
    activeMembers.map((u) =>
      dataAdapter.shareSpreadsheet(spreadsheetId, u['email'] as string, 'editor'),
    ),
  )
}
