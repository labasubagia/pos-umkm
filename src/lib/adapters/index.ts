/**
 * Adapter layer — always uses the Dexie offline-first adapter (Google Sheets backend).
 *
 * Exports:
 *   getRepos()         — typed per-sheet repositories resolving IDs from the store map.
 *   driveClient        — Drive/spreadsheet management (createSpreadsheet, ensureFolder, shareSpreadsheet).
 *   makeRepo()         — one-off raw SheetRepository for setup code (writes headers directly to Sheets).
 *   storeFolderService — traverses Drive folder to build the sheet map.
 *   authAdapter        — Google Identity Services authentication adapter.
 *   syncManager        — drains the offline outbox to Google Sheets.
 *   hydrationService   — pulls Sheets data into IndexedDB on login.
 *
 * Feature modules import from here only — never from sub-modules directly.
 *
 * Testing: unit tests mock this module via vi.mock(); integration tests use the
 * real exports backed by fake-indexeddb (imported in test-setup.ts).
 */

// Lazy import to avoid circular dependency (authStore imports from here indirectly via services)
import { useAuthStore } from "../../store/authStore";
import { ALL_TAB_HEADERS } from "../schema";
import type { IDriveClient } from "./DriveClient";
import { GoogleDriveClient } from "./DriveClient";
import { DexieRepository } from "./dexie/DexieRepository";
import { clearDbCache, getDb } from "./dexie/db";
import { HydrationService } from "./dexie/HydrationService";
import { SyncManager } from "./dexie/SyncManager";
import { GoogleAuthAdapter } from "./google/GoogleAuthAdapter";
import type { Repos } from "./repos";
import type { ISheetRepository } from "./SheetRepository";
import { SheetRepository } from "./SheetRepository";
import { StoreFolderService } from "./StoreFolderService";
import type { AuthAdapter } from "./types";

export const authAdapter: AuthAdapter = new GoogleAuthAdapter();

const getToken = (): string => {
  // Prefer the in-memory token stored in Zustand (set by AuthInitializer)
  const tokenFromStore = useAuthStore.getState().accessToken;
  if (tokenFromStore) return tokenFromStore;
  // Fallback to the adapter's token if present
  const tokenFromAdapter =
    (authAdapter as GoogleAuthAdapter).getAccessToken?.() ?? "";
  return tokenFromAdapter;
};

export const driveClient: IDriveClient = new GoogleDriveClient(getToken);

export const storeFolderService = new StoreFolderService(getToken);

/** No-op SyncManager used as the initial value and after logout. */
const noopSyncManager = {
  start: () => {},
  stop: () => {},
  triggerSync: () => {},
} as unknown as SyncManager;

/** No-op HydrationService used as the initial value and after logout. */
const noopHydrationService = {
  hydrateAll: async () => {},
  forceHydrate: async () => {},
} as unknown as HydrationService;

/**
 * SyncManager — drains the IndexedDB outbox to Google Sheets.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// ...existing code...
export let syncManager: SyncManager = new SyncManager(
  getToken,
  getDb("__init__"),
);
function _getInstanceDbName(obj: unknown): string | undefined {
  return (obj as { db?: { name?: string } })?.db?.name;
}

console.info("[adapters] initial syncManager created (db)", {
  dbName: _getInstanceDbName(syncManager) ?? "unknown",
});

/**
 * HydrationService — pulls Sheets data into IndexedDB after login.
 * Mutable so reinitDexieLayer() can replace it when the active store changes.
 */
// ...existing code...
export let hydrationService: HydrationService = new HydrationService(
  getToken,
  getDb("__init__"),
);

/**
 * Re-initializes the Dexie sync layer for the given store.
 * Call this when the active store changes (user switches store or first login).
 * Stops the old SyncManager, creates new instances backed by the store's DB,
 * and starts the new SyncManager.
 */
export function reinitDexieLayer(storeId: string): void {
  console.info("[adapters] reinitDexieLayer called", { storeId });
  syncManager.stop();
  const db = getDb(storeId);
  syncManager = new SyncManager(getToken, db);
  hydrationService = new HydrationService(getToken, db);
  console.info("[adapters] syncManager reinitialized", {
    dbName: _getInstanceDbName(syncManager) ?? "unknown",
  });
  syncManager.start();
}

/**
 * Resets the Dexie sync layer to no-ops and clears the DB cache.
 * Call on logout so stale IndexedDB connections and references are released.
 */
export function resetDexieLayer(): void {
  syncManager.stop();
  syncManager = noopSyncManager;
  hydrationService = noopHydrationService;
  clearDbCache();
}

/**
 * Returns typed repo instances resolving spreadsheet IDs from the store map.
 * Reads are served from IndexedDB; writes go to IndexedDB + outbox (drained by SyncManager).
 */
export function getRepos(): Repos {
  const { activeStoreId } = useAuthStore.getState();
  return createDexieRepos(activeStoreId ?? "__init__");
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
  return new SheetRepository<T>(
    spreadsheetId,
    sheetName,
    getToken,
    ALL_TAB_HEADERS[sheetName],
  );
}

// ─── Dexie repo factory ────────────────────────────────────────────────────────

/**
 * Creates DexieRepository instances for every sheet in the active store.
 * Each repo writes to IndexedDB + outbox; after each write it calls
 * syncManager.triggerSync() for an immediate drain attempt.
 *
 * Spreadsheet IDs are resolved from the store map at enqueue time.
 * The empty-string fallback in each dexie() call is only used if the
 * store map is not yet populated (e.g. during initial setup).
 */
function createDexieRepos(storeId: string): Repos {
  const storeDb = getDb(storeId);

  function dexie<T extends Record<string, unknown>>(
    sheetName: string,
  ): DexieRepository<T> {
    return new DexieRepository<T>(
      storeDb,
      { spreadsheetId: "", sheetName },
      () => syncManager.triggerSync(),
    );
  }

  return {
    stores: dexie("Stores"),
    monthlySheets: dexie("Monthly_Sheets"),
    categories: dexie("Categories"),
    products: dexie("Products"),
    variants: dexie("Variants"),
    members: dexie("Members"),
    settings: dexie("Settings"),
    stockLog: dexie("Stock_Log"),
    purchaseOrders: dexie("Purchase_Orders"),
    purchaseOrderItems: dexie("Purchase_Order_Items"),
    customers: dexie("Customers"),
    auditLog: dexie("Audit_Log"),
    transactions: dexie("Transactions"),
    transactionItems: dexie("Transaction_Items"),
    refunds: dexie("Refunds"),
  };
}

export type { ILocalRepository } from "./ILocalRepository";
export type { Role, User } from "./types";
export { AdapterError } from "./types";
export type { AuthAdapter, IDriveClient, ISheetRepository, Repos };

/**
 * Writes rows directly to the Dexie table for the active store, bypassing the outbox.
 * Use when the remote write has already happened (e.g. via a direct Sheets API call)
 * and only the local cache needs updating.
 */
export async function localCachePut(
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const { activeStoreId } = useAuthStore.getState();
  const db = getDb(activeStoreId ?? "__init__");
  await db.table(tableName).bulkPut(rows);
}

/**
 * Returns a Dexie-backed Members repository for a specific store's database.
 * Use when mutating another store's Members (e.g. removing self when leaving a store).
 *
 * @param targetStoreId  The store_id whose Dexie DB contains the Members table.
 */
export function getMembersForStore(
  targetStoreId: string,
): DexieRepository<Record<string, unknown>> {
  const db = getDb(targetStoreId);
  return new DexieRepository<Record<string, unknown>>(
    db,
    { spreadsheetId: "", sheetName: "Members" },
    () => syncManager.triggerSync(),
  );
}
