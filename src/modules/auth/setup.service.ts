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
import { nowUTC } from '../../lib/formatters'

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

    // Create (or find) the folder hierarchy apps/pos_umkm/<businessName>/
    // and place the spreadsheet inside it. GoogleDataAdapter implements ensureFolder;
    // MockDataAdapter skips folder creation (returns null, file goes to root).
    let parentFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const folderId = await dataAdapter.ensureFolder(['apps', 'pos_umkm', businessName])
      if (folderId) {
        parentFolderId = folderId
        // Persist folder ID so monthly sheets land in the same folder.
        localStorage.setItem('storeFolderId', folderId)
      }
    }

    const id = await dataAdapter.createSpreadsheet(name, parentFolderId, [...MASTER_TABS])
    // Update the live adapter instance — it was constructed with an empty ID.
    dataAdapter.setSpreadsheetId(id)
    return id
  } catch (err) {
    throw new SetupError(`createMasterSpreadsheet failed: ${String(err)}`, err)
  }
}

/**
 * Initializes all required tab headers in the Master Spreadsheet.
 * Appends a header-sentinel row to each tab so the adapter can detect
 * that the tab has been set up. In GoogleDataAdapter this creates the
 * actual sheet tabs with frozen header rows.
 *
 * For the MockDataAdapter this appends metadata rows so getSheet works.
 */
export async function initializeMasterSheets(spreadsheetId: string): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError('initializeMasterSheets: spreadsheetId is required')
  }
  // Ensure the adapter targets the correct spreadsheet before writing.
  // Critical for GoogleDataAdapter which may still hold an empty ID if this is
  // called independently of createMasterSpreadsheet.
  dataAdapter.setSpreadsheetId(spreadsheetId)
  // Append a sentinel record to each tab to mark it as initialized.
  // Tabs already exist (created by createSpreadsheet with the tabs param);
  // this write just confirms they are writable and records the setup timestamp.
  await Promise.all(
    MASTER_TABS.map((tab) =>
      dataAdapter.appendRow(tab, { _initialized: true, created_at: nowUTC() }),
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
export async function createMonthlySheet(year: number, month: number): Promise<string> {
  try {
    const mm = String(month).padStart(2, '0')
    const name = `POS UMKM — Transactions — ${year}-${mm}`
    // Reuse the store folder created during master-sheet setup so monthly sheets
    // sit alongside the master in apps/pos_umkm/<Store Name>/.
    const parentFolderId = localStorage.getItem('storeFolderId') ?? undefined
    const id = await dataAdapter.createSpreadsheet(name, parentFolderId, [...MONTHLY_TABS])
    localStorage.setItem(monthKey(year, month), id)
    return id
  } catch (err) {
    throw new SetupError(`createMonthlySheet failed: ${String(err)}`, err)
  }
}

/**
 * Initializes the Transactions, Transaction_Items, and Refunds tabs in a monthly sheet.
 */
export async function initializeMonthlySheets(spreadsheetId: string): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError('initializeMonthlySheets: spreadsheetId is required')
  }
  await Promise.all(
    MONTHLY_TABS.map((tab) =>
      dataAdapter.appendRow(tab, { _initialized: true, created_at: nowUTC() }),
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
