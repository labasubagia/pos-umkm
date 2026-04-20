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

/**
 * SyncManager singleton (google adapter only).
 * Drains the IndexedDB outbox to Google Sheets when the device is online.
 * Call syncManager.start() once after the user authenticates.
 * No-op object provided for mock adapter so callers don't need to branch.
 */
export const syncManager: SyncManager = adapterType === 'google'
  ? new SyncManager(getToken)
  : { start: () => {}, stop: () => {}, triggerSync: () => {} } as unknown as SyncManager

/**
 * HydrationService singleton (google adapter only).
 * Pulls Google Sheets data into IndexedDB after login.
 * No-op object provided for mock adapter.
 */
export const hydrationService: HydrationService = adapterType === 'google'
  ? new HydrationService(getToken)
  : { hydrateAll: async () => {}, forceHydrate: async () => {} } as unknown as HydrationService

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
    const { mainSpreadsheetId, spreadsheetId, monthlySpreadsheetId } = useAuthStore.getState()
    return createDexieRepos(
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
  mainId: string,
  masterId: string,
  monthlyId: string,
): Repos {
  function dexie<T extends Record<string, unknown>>(
    spreadsheetId: string,
    sheetName: string,
  ): DexieSheetRepository<T> {
    return new DexieSheetRepository<T>(
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
