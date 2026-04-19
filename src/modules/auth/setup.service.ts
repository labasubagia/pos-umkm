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
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'

/** Tab names that must exist in the Main Spreadsheet (owner's personal store registry). */
export const MAIN_TABS = ['Stores'] as const

/**
 * Column headers for the Main Spreadsheet's Stores tab.
 * TRD §4.2: private to the owner's Google account; never shared with members.
 */
export const MAIN_TAB_HEADERS: Record<string, string[]> = {
  Stores: [
    'store_id', 'store_name', 'master_spreadsheet_id',
    'drive_folder_id', 'owner_email', 'my_role', 'joined_at',
  ],
}

/** All tab names that must exist in the Master Spreadsheet. */
export const MASTER_TABS = [
  'Settings',
  'Members',
  'Categories',
  'Products',
  'Variants',
  'Customers',
  'Purchase_Orders',
  'Purchase_Order_Items',
  'Stock_Log',
  'Audit_Log',
  'Monthly_Sheets',
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
  Members: ['id', 'email', 'name', 'role', 'invited_at', 'deleted_at'],
  Categories: ['id', 'name', 'created_at', 'deleted_at'],
  Products: ['id', 'category_id', 'name', 'sku', 'price', 'stock', 'has_variants', 'created_at', 'deleted_at'],
  Variants: ['id', 'product_id', 'option_name', 'option_value', 'price', 'stock', 'created_at', 'deleted_at'],
  Customers: ['id', 'name', 'phone', 'email', 'created_at', 'deleted_at'],
  Purchase_Orders: ['id', 'supplier', 'status', 'created_at', 'deleted_at'],
  Purchase_Order_Items: ['id', 'order_id', 'product_id', 'product_name', 'qty', 'cost_price', 'created_at'],
  Stock_Log: ['id', 'product_id', 'reason', 'qty_before', 'qty_after', 'created_at'],
  Audit_Log: ['id', 'event', 'data', 'created_at'],
  Monthly_Sheets: ['id', 'year_month', 'spreadsheetId', 'created_at'],
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

/** Returns the zero-padded month string, e.g. "04" for April. */
function mm(month: number): string {
  return String(month).padStart(2, '0')
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
 * First-time setup: creates the Main and Master spreadsheets in the owner's
 * Google Drive following TRD §3.3.
 *
 * Steps:
 *   1. Creates `apps/pos_umkm/main` (owner's private store registry).
 *   2. Writes headers + registers the new store in `main.Stores`.
 *   3. Generates a UUID store_id and creates the store folder
 *      at `apps/pos_umkm/stores/<store_id>/`.
 *   4. Creates `master` spreadsheet inside the store folder.
 *   5. Saves `activeStoreId` and `storeFolderId` to localStorage.
 *   6. Returns the master spreadsheetId.
 *
 * @param businessName  Display name of the store.
 * @param ownerEmail    Owner's Google account email (used for main.Stores row).
 */
export async function createMasterSpreadsheet(
  businessName: string,
  ownerEmail = '',
): Promise<string> {
  try {
    const storeId = generateId()

    // ── 1. Create main spreadsheet (apps/pos_umkm/main) ──────────────────────
    let posUmkmiParentId: string | undefined
    if (dataAdapter.ensureFolder) {
      const fid = await dataAdapter.ensureFolder(['apps', 'pos_umkm'])
      if (fid) posUmkmiParentId = fid
    }
    const mainId = await dataAdapter.createSpreadsheet('main', posUmkmiParentId, [...MAIN_TABS])

    // Write headers to main.Stores tab.
    dataAdapter.setSpreadsheetId(mainId)
    await dataAdapter.writeHeaders('Stores', MAIN_TAB_HEADERS['Stores'] ?? [])

    // ── 2. Create store folder and master spreadsheet ─────────────────────────
    let storeFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const fid = await dataAdapter.ensureFolder(['apps', 'pos_umkm', 'stores', storeId])
      if (fid) storeFolderId = fid
    }

    const masterId = await dataAdapter.createSpreadsheet('master', storeFolderId, [...MASTER_TABS])

    // ── 3. Register new store in main.Stores ──────────────────────────────────
    dataAdapter.setSpreadsheetId(mainId)
    await dataAdapter.appendRow('Stores', {
      store_id: storeId,
      store_name: businessName,
      master_spreadsheet_id: masterId,
      drive_folder_id: storeFolderId ?? '',
      owner_email: ownerEmail,
      my_role: 'owner',
      joined_at: nowUTC(),
    })

    // Restore master as the active spreadsheet for all subsequent calls.
    dataAdapter.setSpreadsheetId(masterId)

    // Persist store context so monthly sheets and other services can locate the folder.
    localStorage.setItem('activeStoreId', storeId)
    if (storeFolderId) localStorage.setItem('storeFolderId', storeFolderId)

    return masterId
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

/**
 * Returns the localStorage key used to cache a monthly transaction sheet ID.
 * LoginPage reads this key on session restore to avoid a Sheets API lookup.
 * Example: txSheet_2026-04
 */
export function monthlySheetKey(year: number, month: number): string {
  return `txSheet_${year}-${mm(month)}`
}

/**
 * Full first-time setup orchestrator — implements TRD §3.3 steps 3–8 and 10.
 *
 * Runs every sub-step in the correct order so the caller (SetupWizard) only
 * needs a single await. Safe to call from the UI layer.
 *
 * Steps performed:
 *   1. createMasterSpreadsheet  — main + store folder + master spreadsheet
 *   2. initializeMasterSheets   — frozen header rows on all master tabs
 *   3. saveSpreadsheetId        — persists masterSpreadsheetId to localStorage
 *   4. createMonthlySheet       — current month's transaction spreadsheet
 *   5. setMonthlySpreadsheetId  — routes adapter writes to the monthly sheet
 *   6. initializeMonthlySheets  — frozen header rows on all monthly tabs
 *   7. saves monthly ID         — persists txSheet_<year>-<month> to localStorage
 *
 * @param businessName  Display name of the store.
 * @param ownerEmail    Owner's Google account email (written to main.Stores).
 */
export async function runFirstTimeSetup(
  businessName: string,
  ownerEmail = '',
): Promise<{ masterSpreadsheetId: string; monthlySpreadsheetId: string }> {
  // Steps 1–3: create and initialize master spreadsheet.
  const masterSpreadsheetId = await createMasterSpreadsheet(businessName, ownerEmail)
  await initializeMasterSheets(masterSpreadsheetId)
  saveSpreadsheetId(masterSpreadsheetId)

  // Steps 4–7: create and initialize the current month's transaction spreadsheet.
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthlySpreadsheetId = await createMonthlySheet(year, month)
  dataAdapter.setMonthlySpreadsheetId(monthlySpreadsheetId)
  await initializeMonthlySheets(monthlySpreadsheetId)
  localStorage.setItem(monthlySheetKey(year, month), monthlySpreadsheetId)

  return { masterSpreadsheetId, monthlySpreadsheetId }
}

// ─── T016 ─────────────────────────────────────────────────────────────────────

/**
 * Returns the spreadsheetId for the current calendar month's transaction sheet
 * by querying the `Monthly_Sheets` registry tab in the master spreadsheet.
 * Returns null if no entry exists for the current month (triggers lazy creation
 * on the first transaction of the month).
 *
 * Reading from the sheet (rather than localStorage) means any user — including
 * cashiers who have no Drive API access — can resolve the monthly sheet ID without
 * a Drive folder listing call.
 */
export async function getCurrentMonthSheetId(): Promise<string | null> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${mm(now.getMonth() + 1)}`
  try {
    const rows = await dataAdapter.getSheet('Monthly_Sheets')
    const row = rows.find((r) => r['year_month'] === yearMonth)
    return (row?.['spreadsheetId'] as string) ?? null
  } catch {
    // Monthly_Sheets tab may not yet exist (pre-setup); treat as no entry.
    return null
  }
}

/**
 * Creates a new monthly transaction spreadsheet.
 * Named "transaction_<year>-<month>" and placed inside the year folder under
 * apps/pos_umkm/stores/<store_id>/transactions/<year>/ in Drive.
 * After creation the entry is registered in the master sheet's `Monthly_Sheets`
 * tab so that any user (including cashiers without Drive API access) can resolve
 * the spreadsheetId from a simple Sheets API read.
 */
export async function createMonthlySheet(year: number, month: number): Promise<string> {
  try {
    const yearMonth = `${year}-${mm(month)}`
    const name = `transaction_${yearMonth}`

    let parentFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const storeId = localStorage.getItem('activeStoreId')
      if (storeId) {
        // Place sheet in apps/pos_umkm/stores/<store_id>/transactions/<year>/
        const folderId = await dataAdapter.ensureFolder([
          'apps', 'pos_umkm', 'stores', storeId, 'transactions', String(year),
        ])
        if (folderId) parentFolderId = folderId
      } else {
        // Fallback: use the store folder directly (pre-existing sessions without activeStoreId)
        parentFolderId = localStorage.getItem('storeFolderId') ?? undefined
      }
    }

    const id = await dataAdapter.createSpreadsheet(name, parentFolderId, [...MONTHLY_TABS])

    // Register in the Monthly_Sheets registry tab so all users can resolve the ID.
    await dataAdapter.appendRow('Monthly_Sheets', {
      id: generateId(),
      year_month: yearMonth,
      spreadsheetId: id,
      created_at: nowUTC(),
    })

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
 * Shares the given spreadsheet with all active members listed in the Members tab.
 * Active members are rows where deleted_at is falsy.
 * Called after creating a new monthly sheet so all members can access it.
 */
export async function shareSheetWithAllMembers(spreadsheetId: string): Promise<void> {
  const members = await dataAdapter.getSheet('Members')
  const activeMembers = members.filter(
    (u) => !u['deleted_at'] && u['email'] && u['email'] !== '',
  )
  await Promise.all(
    activeMembers.map((u) =>
      dataAdapter.shareSpreadsheet(spreadsheetId, u['email'] as string, 'editor'),
    ),
  )
}
