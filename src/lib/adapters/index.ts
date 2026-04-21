/**
 * Active adapter selected at build time via VITE_ADAPTER env var.
 *
 * Exports:
 *   getRepos()         — typed per-sheet repositories reading IDs from the auth store.
 *   driveClient        — Drive/spreadsheet management (createSpreadsheet, ensureFolder, shareSpreadsheet).
 *   makeRepo()         — one-off repo for a specific (spreadsheetId, sheetName); use in setup code
 *                        before a fresh ID has been persisted to the auth store.
 *   authAdapter        — authentication adapter.
 *   syncManager        — (google only) drains the offline outbox to Google Sheets.
 *   hydrationService   — (google only) pulls Sheets data into IndexedDB on login.
 *
 * Feature modules import from here only — never from sub-modules directly.
 *
 * Vite tree-shakes the unused adapter out of the production bundle because
 * the conditional is resolved at build time (import.meta.env is static).
 *
 * Adapter selection:
 *   VITE_ADAPTER=mock   → MockSheetRepository + MockDriveClient + MockAuthAdapter (dev/CI)
 *   VITE_ADAPTER=google → DexieSheetRepository (offline-first) wrapping SheetRepository,
 *                         backed by IndexedDB; outbox drained to Sheets by SyncManager.
 */
import type { IDriveClient } from './DriveClient'
import { GoogleDriveClient, MockDriveClient } from './DriveClient'
import type { AuthAdapter } from './types'
import { GoogleAuthAdapter } from './google/GoogleAuthAdapter'
import { MockAuthAdapter } from './mock/MockAuthAdapter'
import type { ISheetRepository } from './SheetRepository'
import { SheetRepository } from './SheetRepository'
import { MockSheetRepository } from './MockSheetRepository'
import { createMockRepos } from './repos'
import type { Repos } from './repos'
import { ALL_TAB_HEADERS } from '../schema'
import { DexieSheetRepository } from './dexie/DexieSheetRepository'
import { SyncManager } from './dexie/SyncManager'
import { HydrationService } from './dexie/HydrationService'
import { getDb, clearDbCache } from './dexie/db'

// Lazy import to avoid circular dependency (authStore imports from here indirectly via services)
import { useAuthStore } from '../../store/authStore'

const adapterType = import.meta.env.VITE_ADAPTER ?? 'mock'

export const authAdapter: AuthAdapter = adapterType === 'google'
  ? new GoogleAuthAdapter()
  : new MockAuthAdapter()

const getToken = (): string =>
  adapterType === 'google' ? (authAdapter as GoogleAuthAdapter).getAccessToken() ?? '' : ''

export const driveClient: IDriveClient = adapterType === 'google'
  ? new GoogleDriveClient(getToken)
  : new MockDriveClient()

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
 * SyncManager (google adapter only) — drains the IndexedDB outbox to Google Sheets.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// eslint-disable-next-line prefer-const
export let syncManager: SyncManager = adapterType === 'google'
  ? new SyncManager(getToken, getDb('__init__'))
  : noopSyncManager

/**
 * HydrationService (google adapter only) — pulls Sheets data into IndexedDB after login.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// eslint-disable-next-line prefer-const
export let hydrationService: HydrationService = adapterType === 'google'
  ? new HydrationService(getToken, getDb('__init__'))
  : noopHydrationService

/**
 * Re-initializes the Dexie sync layer for the given store.
 * Call this when the active store changes (user switches store or first login).
 * Stops the old SyncManager, creates new instances backed by the store's DB,
 * and starts the new SyncManager.
 */
export function reinitDexieLayer(storeId: string): void {
  if (adapterType !== 'google') return
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
  if (adapterType !== 'google') return
  syncManager.stop()
  syncManager = noopSyncManager
  hydrationService = noopHydrationService
  clearDbCache()
}

/**
 * Returns typed repo instances reading IDs from the current auth store state.
 *
 * Google adapter: returns DexieSheetRepository instances (offline-first).
 *   Reads are served from IndexedDB; writes go to IndexedDB + outbox.
 *   SyncManager drains the outbox to Sheets in the background.
 *
 * Mock adapter: returns MockSheetRepository instances (localStorage, dev/CI).
 */
export function getRepos(): Repos {
  if (adapterType === 'google') {
    const { mainSpreadsheetId, spreadsheetId, monthlySpreadsheetId, activeStoreId } = useAuthStore.getState()
    return createDexieRepos(
      activeStoreId ?? '__init__',
      mainSpreadsheetId ?? '',
      spreadsheetId ?? '',
      monthlySpreadsheetId ?? '',
    )
  }
  return createMockRepos()
}

/**
 * Creates a one-off repo for a specific spreadsheetId + sheetName.
 * Use in setup/initialization code where a freshly-created spreadsheet ID
 * is not yet stored in the auth store.
 *
 * During setup (SetupWizard) the app is always online so we use the raw
 * SheetRepository (no Dexie wrapper) to write headers directly to Sheets.
 */
export function makeRepo<T extends Record<string, unknown>>(
  spreadsheetId: string,
  sheetName: string,
): ISheetRepository<T> {
  if (adapterType === 'google') {
    return new SheetRepository<T>(spreadsheetId, sheetName, getToken, ALL_TAB_HEADERS[sheetName])
  }
  return new MockSheetRepository<T>(sheetName)
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
  ): DexieSheetRepository<T> {
    return new DexieSheetRepository<T>(
      storeDb,
      spreadsheetId,
      sheetName,
      // Remote repo factory — evaluated lazily by DexieSheetRepository.writeHeaders()
      () => new SheetRepository<T>(spreadsheetId, sheetName, getToken, ALL_TAB_HEADERS[sheetName]),
    )
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
export type { AuthAdapter }
export { AdapterError } from './types'
export type { User, Role } from './types'
