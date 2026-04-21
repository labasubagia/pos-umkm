/**
 * Adapter layer — always uses the Dexie offline-first adapter (Google Sheets backend).
 *
 * Exports:
 *   getRepos()         — typed per-sheet repositories reading IDs from the auth store.
 *   driveClient        — Drive/spreadsheet management (createSpreadsheet, ensureFolder, shareSpreadsheet).
 *   makeRepo()         — one-off raw SheetRepository for setup code (writes headers directly to Sheets).
 *   authAdapter        — Google Identity Services authentication adapter.
 *   syncManager        — drains the offline outbox to Google Sheets.
 *   hydrationService   — pulls Sheets data into IndexedDB on login.
 *
 * Feature modules import from here only — never from sub-modules directly.
 *
 * Testing: unit tests mock this module via vi.mock(); integration tests use the
 * real exports backed by fake-indexeddb (imported in test-setup.ts).
 */
import type { IDriveClient } from './DriveClient'
import { GoogleDriveClient } from './DriveClient'
import type { AuthAdapter } from './types'
import { GoogleAuthAdapter } from './google/GoogleAuthAdapter'
import type { ISheetRepository } from './SheetRepository'
import { SheetRepository } from './SheetRepository'
import type { Repos } from './repos'
import { ALL_TAB_HEADERS } from '../schema'
import { DexieRepository } from './dexie/DexieRepository'
import { SyncManager } from './dexie/SyncManager'
import { HydrationService } from './dexie/HydrationService'
import { getDb, clearDbCache } from './dexie/db'

// Lazy import to avoid circular dependency (authStore imports from here indirectly via services)
import { useAuthStore } from '../../store/authStore'

export const authAdapter: AuthAdapter = new GoogleAuthAdapter()

const getToken = (): string => (authAdapter as GoogleAuthAdapter).getAccessToken() ?? ''

export const driveClient: IDriveClient = new GoogleDriveClient(getToken)

/** No-op SyncManager used as the initial value and after logout. */
const noopSyncManager = {
  start: () => {},
  stop: () => {},
  triggerSync: () => {},
} as unknown as SyncManager

/** No-op HydrationService used as the initial value and after logout. */
const noopHydrationService = {
  hydrateAll: async () => {},
  forceHydrate: async () => {},
} as unknown as HydrationService

/**
 * SyncManager — drains the IndexedDB outbox to Google Sheets.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// eslint-disable-next-line prefer-const
export let syncManager: SyncManager = new SyncManager(getToken, getDb('__init__'))

/**
 * HydrationService — pulls Sheets data into IndexedDB after login.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// eslint-disable-next-line prefer-const
export let hydrationService: HydrationService = new HydrationService(getToken, getDb('__init__'))

/**
 * Re-initializes the Dexie sync layer for the given store.
 * Call this when the active store changes (user switches store or first login).
 * Stops the old SyncManager, creates new instances backed by the store's DB,
 * and starts the new SyncManager.
 */
export function reinitDexieLayer(storeId: string): void {
  syncManager.stop()
  const db = getDb(storeId)
  syncManager = new SyncManager(getToken, db)
  hydrationService = new HydrationService(getToken, db)
  syncManager.start()
}

/**
 * Resets the Dexie sync layer to no-ops and clears the DB cache.
 * Call on logout so stale IndexedDB connections and references are released.
 */
export function resetDexieLayer(): void {
  syncManager.stop()
  syncManager = noopSyncManager
  hydrationService = noopHydrationService
  clearDbCache()
}

/**
 * Returns typed repo instances reading IDs from the current auth store state.
 * Reads are served from IndexedDB; writes go to IndexedDB + outbox (drained by SyncManager).
 */
export function getRepos(): Repos {
  const { mainSpreadsheetId, spreadsheetId, monthlySpreadsheetId, activeStoreId } = useAuthStore.getState()
  return createDexieRepos(
    activeStoreId ?? '__init__',
    mainSpreadsheetId ?? '',
    spreadsheetId ?? '',
    monthlySpreadsheetId ?? '',
  )
}

/**
 * Creates a one-off raw SheetRepository for a specific spreadsheetId + sheetName.
 * Use in setup/initialization code where a freshly-created spreadsheet ID
 * is not yet stored in the auth store.
 *
 * Uses raw SheetRepository (no Dexie wrapper) to write headers directly to Sheets
 * during SetupWizard — always requires an active internet connection.
 */
export function makeRepo<T extends Record<string, unknown>>(
  spreadsheetId: string,
  sheetName: string,
): ISheetRepository<T> {
  return new SheetRepository<T>(spreadsheetId, sheetName, getToken, ALL_TAB_HEADERS[sheetName])
}

// ─── Dexie repo factory ────────────────────────────────────────────────────────

/**
 * Wraps each SheetRepository in a DexieSheetRepository so all reads go through
 * IndexedDB and all writes are queued to the _outbox for later sync to Sheets.
 *
 * The `getRemoteRepo` factory is called lazily at sync time (SyncManager creates
 * SheetRepository on the fly) so IDs don't need to be captured at call time.
 */
function createDexieRepos(
  storeId: string,
  mainId: string,
  masterId: string,
  monthlyId: string,
): Repos {
  const storeDb = getDb(storeId)

  function dexie<T extends Record<string, unknown>>(
    spreadsheetId: string,
    sheetName: string,
  ): DexieRepository<T> {
    return new DexieRepository<T>(storeDb, { spreadsheetId, sheetName })
  }

  return {
    stores:             dexie(mainId,    'Stores'),
    monthlySheets:      dexie(masterId,  'Monthly_Sheets'),
    categories:         dexie(masterId,  'Categories'),
    products:           dexie(masterId,  'Products'),
    variants:           dexie(masterId,  'Variants'),
    members:            dexie(masterId,  'Members'),
    settings:           dexie(masterId,  'Settings'),
    stockLog:           dexie(masterId,  'Stock_Log'),
    purchaseOrders:     dexie(masterId,  'Purchase_Orders'),
    purchaseOrderItems: dexie(masterId,  'Purchase_Order_Items'),
    customers:          dexie(masterId,  'Customers'),
    auditLog:           dexie(masterId,  'Audit_Log'),
    transactions:       dexie(monthlyId, 'Transactions'),
    transactionItems:   dexie(monthlyId, 'Transaction_Items'),
    refunds:            dexie(monthlyId, 'Refunds'),
  }
}

export type { IDriveClient, ISheetRepository, Repos }
export type { ILocalRepository } from './ILocalRepository'
export type { AuthAdapter }
export { AdapterError } from './types'
export type { User, Role } from './types'

/**
 * Writes rows directly to the Dexie table for the active store, bypassing the outbox.
 * Use when the remote write has already happened (e.g. via a direct Sheets API call)
 * and only the local cache needs updating.
 */
export async function localCachePut(
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const { activeStoreId } = useAuthStore.getState()
  const db = getDb(activeStoreId ?? '__init__')
  await db.table(tableName).bulkPut(rows)
}

/**
 * Returns a Dexie-backed Members repository for a specific store's database.
 * Use when mutating another store's Members (e.g. removing self when leaving a store).
 *
 * @param targetStoreId        The store_id whose Dexie DB contains the Members table.
 * @param masterSpreadsheetId  The spreadsheetId used as the outbox sync target.
 */
export function getMembersForStore(
  targetStoreId: string,
  masterSpreadsheetId: string,
): DexieRepository<Record<string, unknown>> {
  const db = getDb(targetStoreId)
  return new DexieRepository<Record<string, unknown>>(
    db,
    { spreadsheetId: masterSpreadsheetId, sheetName: 'Members' },
  )
}
