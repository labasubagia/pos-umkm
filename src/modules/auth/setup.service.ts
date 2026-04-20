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

import { getRepos, driveClient, makeRepo } from '../../lib/adapters'
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'
import { useAuthStore } from '../../store/authStore'
import {
  MAIN_TABS,
  MASTER_TABS,
  MONTHLY_TABS,
  MAIN_TAB_HEADERS,
  MASTER_TAB_HEADERS,
  MONTHLY_TAB_HEADERS,
} from '../../lib/schema'

// Re-export so existing callers that imported from this module continue to work.
export {
  MAIN_TABS,
  MASTER_TABS,
  MONTHLY_TABS,
  MAIN_TAB_HEADERS,
  MASTER_TAB_HEADERS,
  MONTHLY_TAB_HEADERS,
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
    const fid = await driveClient.ensureFolder(['apps', 'pos_umkm'])
    if (fid) parentFolderId = fid
    const mainId = await driveClient.createSpreadsheet('main', parentFolderId, [...MAIN_TABS])
    await makeRepo(mainId, 'Stores').writeHeaders(MAIN_TAB_HEADERS['Stores'] ?? [])
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
  const rows = await makeRepo(mainSpreadsheetId, 'Stores').getAll()
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
 *
 * @param storeId  The `store_id` of the store being renamed.
 * @param newName  The new store/business name.
 */
export async function updateStoreName(
  storeId: string,
  newName: string,
): Promise<void> {
  const mainId = getMainSpreadsheetId()
  if (!mainId) throw new SetupError('updateStoreName: mainSpreadsheetId not found')

  try {
    await makeRepo(mainId, 'Stores').batchUpdateCells([{ rowId: storeId, column: 'store_name', value: newName }])
  } catch (err) {
    if (err instanceof Error && err.name === 'AdapterError' && err.message.includes('not found')) {
      throw new SetupError(`updateStoreName: store ${storeId} not found in main.Stores`)
    }
    throw err
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

  useAuthStore.getState().setSpreadsheetId(masterId)
  // activeStoreId must be in localStorage synchronously — createMonthlySheet()
  // reads it during this same call to determine the Drive folder path.
  localStorage.setItem('activeStoreId', storeId)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const yearMonth = `${year}-${mm(month)}`

  // Read Monthly_Sheets directly from the master spreadsheet via a raw
  // SheetRepository (makeRepo), bypassing the Dexie cache. At this point
  // reinitDexieLayer() has not yet run for the new store (it fires in
  // AppShell's useEffect after the Zustand state update), so getRepos()
  // would read from the *previous* store's IndexedDB and return the wrong
  // monthly spreadsheet ID, causing cross-store data contamination.
  let monthlyId: string | null = null
  try {
    const rows = await makeRepo(masterId, 'Monthly_Sheets').getAll()
    const row = rows.find((r) => (r as Record<string, unknown>)['year_month'] === yearMonth)
    monthlyId = ((row as Record<string, unknown>)?.['spreadsheetId'] as string) ?? null
  } catch {
    // Monthly_Sheets tab may not yet exist (pre-setup); treat as no entry.
  }

  if (!monthlyId) {
    try {
      monthlyId = await createMonthlySheet(year, month)
      useAuthStore.getState().setMonthlySpreadsheetId(monthlyId)
      await initializeMonthlySheets(monthlyId)
    } catch {
      // Cashiers lack the drive scope to create monthly sheets.
      // The monthly sheet must be pre-created by an owner or manager.
      return
    }
  } else {
    useAuthStore.getState().setMonthlySpreadsheetId(monthlyId)
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
    const fid = await driveClient.ensureFolder(['apps', 'pos_umkm', 'stores', storeId])
    if (fid) storeFolderId = fid

    // ── 2. Create master spreadsheet ──────────────────────────────────────────
    const masterId = await driveClient.createSpreadsheet('master', storeFolderId, [...MASTER_TABS])

    // ── 3. Register new store in main.Stores ──────────────────────────────────
    await makeRepo(mainSpreadsheetId, 'Stores').batchAppend([{
      store_id: storeId,
      store_name: businessName,
      master_spreadsheet_id: masterId,
      drive_folder_id: storeFolderId ?? '',
      owner_email: ownerEmail,
      my_role: 'owner',
      joined_at: nowUTC(),
    }])

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
  await Promise.all(
    MASTER_TABS.map((tab) => makeRepo(spreadsheetId, tab).writeHeaders(MASTER_TAB_HEADERS[tab] ?? [])),
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
    const rows = await getRepos().monthlySheets.getAll()
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
    const storeId = localStorage.getItem('activeStoreId')
    if (storeId) {
      const folderId = await driveClient.ensureFolder([
        'apps', 'pos_umkm', 'stores', storeId, 'transactions', String(year),
      ])
      if (folderId) parentFolderId = folderId
    } else {
      // Fallback: use the store folder directly (pre-existing sessions without activeStoreId)
      parentFolderId = localStorage.getItem('storeFolderId') ?? undefined
    }

    const id = await driveClient.createSpreadsheet(name, parentFolderId, [...MONTHLY_TABS])

    // Register in the Monthly_Sheets registry tab so all users can resolve the ID.
    await getRepos().monthlySheets.batchAppend([{
      id: generateId(),
      year_month: yearMonth,
      spreadsheetId: id,
      created_at: nowUTC(),
    }])

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
    MONTHLY_TABS.map((tab) => makeRepo(spreadsheetId, tab).writeHeaders(MONTHLY_TAB_HEADERS[tab] ?? [])),
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
  useAuthStore.getState().setMonthlySpreadsheetId(monthlySpreadsheetId)
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
  const members = await getRepos().members.getAll()
  const activeMembers = members.filter(
    (u) => !u['deleted_at'] && u['email'] && u['email'] !== '',
  )
  await Promise.all(
    activeMembers.map((u) =>
      driveClient.shareSpreadsheet(spreadsheetId, u['email'] as string, 'editor'),
    ),
  )
}

