/**
 * setup.service.ts — Owner first-time setup and monthly sheet management.
 *
 * Responsible for:
 * 1. Detecting or creating the Main spreadsheet (owner's personal store registry).
 * 2. Creating store spreadsheets (master + monthly) for each branch.
 * 3. Activating a store by routing the adapter to the correct spreadsheets.
 * 4. Managing monthly transaction spreadsheets (lazy creation on first tx).
 *
 * Uses the active DataAdapter so these calls work with both Mock and Google
 * adapters — no direct Sheets API calls from this file.
 */

import { dataAdapter } from '../../lib/adapters'
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'
import { useAuthStore } from '../../store/authStore'

// ─── Constants ────────────────────────────────────────────────────────────────

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

/** Column headers for each Monthly Sheet tab. */
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

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One row from the main.Stores tab — represents a store the user owns or has joined.
 * This is the shape returned by listStores() and consumed by activateStore().
 */
export interface StoreRecord {
  store_id: string
  store_name: string
  master_spreadsheet_id: string
  drive_folder_id: string
  owner_email: string
  my_role: string
  joined_at: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

/** Returns the mainSpreadsheetId from Zustand (persisted), falling back to the
 *  legacy direct localStorage key for users migrating from pre-Zustand sessions. */
export function getMainSpreadsheetId(): string | null {
  return useAuthStore.getState().mainSpreadsheetId ?? localStorage.getItem('mainSpreadsheetId')
}

/** Persists the mainSpreadsheetId to Zustand (which persists to localStorage via
 *  the `pos-umkm-auth` key). Also writes the legacy direct key so old code paths
 *  and any backward-compat reads continue to work during the transition period. */
export function saveMainSpreadsheetId(id: string): void {
  useAuthStore.getState().setMainSpreadsheetId(id)
  localStorage.setItem('mainSpreadsheetId', id) // legacy fallback key
}

/**
 * Persists the master spreadsheetId to Zustand (persisted) and the legacy
 * direct localStorage key. Called from runStoreSetup after creating a new store.
 */
export function saveSpreadsheetId(spreadsheetId: string): void {
  useAuthStore.getState().setSpreadsheetId(spreadsheetId)
  localStorage.setItem('masterSpreadsheetId', spreadsheetId) // legacy fallback key
}

/**
 * Removes all setup-related localStorage keys. Call this on sign-out to prevent
 * stale spreadsheet IDs from being picked up on the next login (especially if a
 * different Google account signs in on the same device).
 *
 * Note: Zustand `clearAuth()` already clears the persisted `pos-umkm-auth` blob.
 * This function cleans up the additional direct-write keys that setup.service.ts
 * and legacy code paths write to localStorage independently.
 */
export function clearSetupStorage(): void {
  localStorage.removeItem('mainSpreadsheetId')
  localStorage.removeItem('masterSpreadsheetId')
  localStorage.removeItem('activeStoreId')
  localStorage.removeItem('storeFolderId')
  // Clear all monthly transaction sheet cache keys (txSheet_YYYY-MM).
  Object.keys(localStorage)
    .filter((k) => k.startsWith('txSheet_'))
    .forEach((k) => localStorage.removeItem(k))
}

/**
 * Returns the localStorage key used to cache a monthly transaction sheet ID.
 * LoginPage reads this key on session restore to avoid a Sheets API lookup.
 * Example: txSheet_2026-04
 */
export function monthlySheetKey(year: number, month: number): string {
  return `txSheet_${year}-${mm(month)}`
}

// ─── Main Spreadsheet ─────────────────────────────────────────────────────────

/**
 * Creates the `main` spreadsheet at apps/pos_umkm/main in the owner's Drive.
 * This is the owner's private store registry (never shared with members).
 * Called once per Google account — subsequent logins read from it.
 * Writes the Stores tab header row immediately after creation.
 */
export async function createMainSpreadsheet(ownerEmail = ''): Promise<string> {
  try {
    let parentFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const fid = await dataAdapter.ensureFolder(['apps', 'pos_umkm'])
      if (fid) parentFolderId = fid
    }
    const mainId = await dataAdapter.createSpreadsheet('main', parentFolderId, [...MAIN_TABS])
    dataAdapter.setSpreadsheetId(mainId)
    await dataAdapter.writeHeaders('Stores', MAIN_TAB_HEADERS['Stores'] ?? [])
    void ownerEmail // reserved for future row insertion on member join flow
    return mainId
  } catch (err) {
    throw new SetupError(`createMainSpreadsheet failed: ${String(err)}`, err)
  }
}

/**
 * Reads all store rows from main.Stores.
 * Temporarily routes the adapter to mainSpreadsheetId, then leaves it pointing
 * at main — callers that activate a store must call setSpreadsheetId(masterId).
 */
export async function listStores(mainSpreadsheetId: string): Promise<StoreRecord[]> {
  dataAdapter.setSpreadsheetId(mainSpreadsheetId)
  const rows = await dataAdapter.getSheet('Stores')
  return rows
    .filter((r) => r['store_id'] && r['master_spreadsheet_id'])
    .map((r) => ({
      store_id: String(r['store_id']),
      store_name: String(r['store_name'] ?? ''),
      master_spreadsheet_id: String(r['master_spreadsheet_id']),
      drive_folder_id: String(r['drive_folder_id'] ?? ''),
      owner_email: String(r['owner_email'] ?? ''),
      my_role: String(r['my_role'] ?? 'owner'),
      joined_at: String(r['joined_at'] ?? ''),
    }))
}

/**
 * Updates the `store_name` column in the main spreadsheet's `Stores` tab.
 *
 * Called when the owner renames their business in Settings > Profil Bisnis.
 * The main spreadsheet is the registry shared across all stores so the store
 * picker shows the up-to-date name.
 *
 * Steps:
 *   1. Temporarily routes the adapter to mainSpreadsheetId.
 *   2. Finds the row for `storeId` in the `Stores` tab.
 *   3. Updates the `store_name` cell for that row.
 *   4. Restores adapter routing to the master spreadsheetId so all
 *      subsequent service calls continue to target the active store.
 *
 * @param storeId           The `store_id` of the store being renamed.
 * @param newName           The new store/business name.
 * @param masterSpreadsheetId  The master spreadsheetId to restore after the update.
 */
export async function updateStoreName(
  storeId: string,
  newName: string,
  masterSpreadsheetId: string,
): Promise<void> {
  const mainId = getMainSpreadsheetId()
  if (!mainId) throw new SetupError('updateStoreName: mainSpreadsheetId not found')

  try {
    dataAdapter.setSpreadsheetId(mainId)
    const rows = await dataAdapter.getSheet('Stores')
    const row = rows.find((r) => String(r['store_id']) === storeId)
    if (!row) throw new SetupError(`updateStoreName: store ${storeId} not found in main.Stores`)
    await dataAdapter.updateCell('Stores', row['id'] as string, 'store_name', newName)
  } finally {
    // Always restore master as the active spreadsheet so subsequent calls
    // (e.g. reading Settings) continue to target the correct store sheet.
    dataAdapter.setSpreadsheetId(masterSpreadsheetId)
  }
}

/**
 * Post-login entry point: finds the owner's main spreadsheet or creates it.
 *
 * On every login (not just first-time) this function:
 *   1. Checks localStorage for a cached mainSpreadsheetId (fast path).
 *   2. If not cached: calls createMainSpreadsheet() which uses Drive "find or
 *      create" — searches apps/pos_umkm/ for an existing `main` spreadsheet
 *      before creating a new one. This means clearing localStorage never causes
 *      a duplicate main spreadsheet.
 *   3. Reads and returns the current store list from main.Stores.
 *
 * The caller (StorePickerPage) routes to /setup (0 stores), auto-activates
 * (1 store), or shows the picker (2+ stores).
 */
export async function findOrCreateMain(
  ownerEmail = '',
): Promise<{ mainSpreadsheetId: string; stores: StoreRecord[] }> {
  try {
    let mainId = getMainSpreadsheetId()

    if (!mainId) {
      // Cache miss — use Drive to find the existing file or create a new one.
      // createMainSpreadsheet calls createSpreadsheet with a parentFolderId so
      // the "find or create" search in drive.client.ts is triggered: if
      // apps/pos_umkm/main already exists, its ID is returned (not a new file).
      mainId = await createMainSpreadsheet(ownerEmail)
      saveMainSpreadsheetId(mainId)
    }

    // Always read stores — whether mainId came from cache or from Drive.
    const stores = await listStores(mainId)
    return { mainSpreadsheetId: mainId, stores }
  } catch (err) {
    throw new SetupError(`findOrCreateMain failed: ${String(err)}`, err)
  }
}

// ─── Store Activation ─────────────────────────────────────────────────────────

/**
 * Activates a store selected from the store picker.
 *
 * Sets the adapter's master spreadsheet routing, saves IDs to localStorage,
 * then resolves the current month's transaction sheet (creating it if missing
 * and the user has the `drive` scope — owners and managers only).
 *
 * Cashiers who lack the drive scope will land on a store without a monthly sheet
 * if the owner has not yet created one for this month; pages should handle this
 * gracefully with an empty-state message rather than crashing.
 */
export async function activateStore(store: StoreRecord): Promise<void> {
  const { master_spreadsheet_id: masterId, store_id: storeId } = store

  dataAdapter.setSpreadsheetId(masterId)
  // activeStoreId must be in localStorage synchronously — createMonthlySheet()
  // reads it during this same call to determine the Drive folder path.
  localStorage.setItem('activeStoreId', storeId)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  let monthlyId = await getCurrentMonthSheetId()
  if (!monthlyId) {
    try {
      monthlyId = await createMonthlySheet(year, month)
      dataAdapter.setMonthlySpreadsheetId(monthlyId)
      await initializeMonthlySheets(monthlyId)
    } catch {
      // Cashiers lack the drive scope to create monthly sheets.
      // The monthly sheet must be pre-created by an owner or manager.
      return
    }
  } else {
    dataAdapter.setMonthlySpreadsheetId(monthlyId)
  }

  localStorage.setItem(monthlySheetKey(year, month), monthlyId)
}

// ─── Master Spreadsheet ───────────────────────────────────────────────────────

/**
 * Creates the `master` spreadsheet for a new store and registers it in main.Stores.
 *
 * Assumes the main spreadsheet already exists — call findOrCreateMain() first.
 * Does NOT create main (that is findOrCreateMain's responsibility).
 *
 * Steps:
 *   1. Generates a UUID store_id.
 *   2. Creates apps/pos_umkm/stores/<store_id>/ folder.
 *   3. Creates `master` spreadsheet inside the store folder.
 *   4. Registers the new store in main.Stores tab.
 *   5. Restores adapter routing to master.
 *   6. Saves activeStoreId and storeFolderId to localStorage.
 *
 * @param businessName    Store display name.
 * @param ownerEmail      Owner's Google account email.
 * @param mainSpreadsheetId  The main spreadsheet to register the store in.
 */
export async function createMasterSpreadsheet(
  businessName: string,
  ownerEmail = '',
  mainSpreadsheetId: string,
): Promise<string> {
  try {
    const storeId = generateId()

    // ── 1. Create store folder ────────────────────────────────────────────────
    let storeFolderId: string | undefined
    if (dataAdapter.ensureFolder) {
      const fid = await dataAdapter.ensureFolder(['apps', 'pos_umkm', 'stores', storeId])
      if (fid) storeFolderId = fid
    }

    // ── 2. Create master spreadsheet ──────────────────────────────────────────
    const masterId = await dataAdapter.createSpreadsheet('master', storeFolderId, [...MASTER_TABS])

    // ── 3. Register new store in main.Stores ──────────────────────────────────
    dataAdapter.setSpreadsheetId(mainSpreadsheetId)
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

// ─── Monthly Spreadsheet ──────────────────────────────────────────────────────

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

// ─── Setup Orchestrators ──────────────────────────────────────────────────────

/**
 * Creates a new store (master + monthly spreadsheets) using the main spreadsheet
 * already present in localStorage. Called from SetupWizard for both first-time
 * setup and adding a new branch.
 *
 * Precondition: findOrCreateMain() must have been called before navigating to
 * /setup, so that mainSpreadsheetId is persisted in localStorage.
 *
 * Steps:
 *   1. createMasterSpreadsheet → store folder + master spreadsheet + main.Stores row
 *   2. initializeMasterSheets  → frozen header rows on all master tabs
 *   3. saveSpreadsheetId       → persists masterSpreadsheetId to localStorage
 *   4. createMonthlySheet      → current month's transaction spreadsheet
 *   5. setMonthlySpreadsheetId → routes adapter writes to the monthly sheet
 *   6. initializeMonthlySheets → frozen header rows on all monthly tabs
 *   7. saves txSheet key       → persists monthly ID for fast session restore
 */
export async function runStoreSetup(
  businessName: string,
  ownerEmail = '',
): Promise<{ masterSpreadsheetId: string; monthlySpreadsheetId: string }> {
  const mainId = getMainSpreadsheetId()
  if (!mainId) {
    throw new SetupError(
      'runStoreSetup: mainSpreadsheetId not found in localStorage. Call findOrCreateMain() first.',
    )
  }

  const masterSpreadsheetId = await createMasterSpreadsheet(businessName, ownerEmail, mainId)
  await initializeMasterSheets(masterSpreadsheetId)
  saveSpreadsheetId(masterSpreadsheetId)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthlySpreadsheetId = await createMonthlySheet(year, month)
  dataAdapter.setMonthlySpreadsheetId(monthlySpreadsheetId)
  await initializeMonthlySheets(monthlySpreadsheetId)
  localStorage.setItem(monthlySheetKey(year, month), monthlySpreadsheetId)

  return { masterSpreadsheetId, monthlySpreadsheetId }
}

/**
 * Full first-time setup orchestrator — implements TRD §3.3 steps 3–8 and 10.
 * Combines findOrCreateMain + runStoreSetup into one call.
 * Retained for testing convenience and backward compatibility.
 *
 * @param businessName  Display name of the store.
 * @param ownerEmail    Owner's Google account email.
 */
export async function runFirstTimeSetup(
  businessName: string,
  ownerEmail = '',
): Promise<{ masterSpreadsheetId: string; monthlySpreadsheetId: string }> {
  const { mainSpreadsheetId } = await findOrCreateMain(ownerEmail)
  saveMainSpreadsheetId(mainSpreadsheetId)
  return runStoreSetup(businessName, ownerEmail)
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

