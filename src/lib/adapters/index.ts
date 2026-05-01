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
import { HydrationService } from "../HydrationService";
import { logger } from "../logger";
import { SyncManager } from "../SyncManager";
import { ALL_TAB_HEADERS } from "../schema";
import type { IDriveClient } from "./DriveClient";
import { GoogleDriveClient } from "./DriveClient";
import { DexieRepository } from "./dexie/DexieRepository";
import { clearDbCache, getDb } from "./dexie/db";
import {
  ProductRepository,
  PurchaseOrderItemRepository,
  TransactionItemRepository,
  TransactionRepository,
  VariantRepository,
} from "./dexie/typed-repos";
import { GoogleAuthAdapter } from "./google/GoogleAuthAdapter";
import { SheetRepository } from "./google/SheetRepository";
import { StoreFolderService } from "./google/StoreFolderService";
import type { Repos } from "./LocalRepository";
import type { IRemoteRepository } from "./RemoteRepository";
import type { AuthAdapter } from "./types";
import type {
  AuditLog,
  Category,
  Customer,
  Member,
  MonthlySheet,
  PurchaseOrder,
  Refund,
  Setting,
  StockLog,
  Store,
} from "./zod-schemas";

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

export const storeFolderService = new StoreFolderService();

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
/**
 * SyncManager for the global __main__ DB (drains Stores/cross-store outbox).
 * Runs independently of the per-store syncManager so store-management mutations
 * (updateStore, removeOwnedStore) are synced to the main spreadsheet regardless
 * of which per-store DB is currently active.
 */
export let mainSyncManager: SyncManager = new SyncManager(
  getToken,
  getDb("__main__"),
);
function _getInstanceDbName(obj: unknown): string | undefined {
  return (obj as { db?: { name?: string } })?.db?.name;
}

logger.info("[adapters] initial syncManager created (db)", {
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
  getDb("__main__"),
);

/**
 * Re-initializes the Dexie sync layer for the given store.
 * Call this when the active store changes (user switches store or first login).
 * Stops the old SyncManager, creates new instances backed by the store's DB,
 * and starts the new SyncManager.
 */
export function reinitDexieLayer(storeId: string): void {
  logger.info("[adapters] reinitDexieLayer called", { storeId });
  syncManager.stop();
  mainSyncManager.stop();
  const db = getDb(storeId);
  const mainDb = getDb("__main__");
  syncManager = new SyncManager(getToken, db);
  mainSyncManager = new SyncManager(getToken, mainDb);
  hydrationService = new HydrationService(getToken, db, mainDb);
  logger.info("[adapters] syncManager reinitialized", {
    dbName: _getInstanceDbName(syncManager) ?? "unknown",
  });
  syncManager.start();
  mainSyncManager.start();
}

/**
 * Resets the Dexie sync layer to no-ops and clears the DB cache.
 * Call on logout so stale IndexedDB connections and references are released.
 */
export function resetDexieLayer(): void {
  syncManager.stop();
  mainSyncManager.stop();
  syncManager = noopSyncManager;
  mainSyncManager = noopSyncManager;
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
): IRemoteRepository<T> {
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
  // Stores is a cross-store (main-spreadsheet) table — always use the global
  // __main__ DB so the list is identical regardless of which store is active,
  // and per-store outbox entries never block Stores hydration.
  const mainDb = getDb("__main__");

  function dexie<T extends Record<string, unknown>>(
    tableName: string,
  ): DexieRepository<T> {
    return new DexieRepository<T>(storeDb, tableName, () =>
      syncManager.triggerSync(),
    );
  }

  return {
    stores: new DexieRepository<Store>(mainDb, "Stores", () =>
      mainSyncManager.triggerSync(),
    ),
    monthlySheets: dexie<MonthlySheet>("Monthly_Sheets"),
    categories: dexie<Category>("Categories"),
    products: new ProductRepository(storeDb, "Products", () =>
      syncManager.triggerSync(),
    ),
    variants: new VariantRepository(storeDb, "Variants", () =>
      syncManager.triggerSync(),
    ),
    members: dexie<Member>("Members"),
    settings: dexie<Setting>("Settings"),
    stockLog: dexie<StockLog>("Stock_Log"),
    purchaseOrders: dexie<PurchaseOrder>("Purchase_Orders"),
    purchaseOrderItems: new PurchaseOrderItemRepository(
      storeDb,
      "Purchase_Order_Items",
      () => syncManager.triggerSync(),
    ),
    customers: dexie<Customer>("Customers"),
    auditLog: dexie<AuditLog>("Audit_Log"),
    transactions: new TransactionRepository(storeDb, "Transactions", () =>
      syncManager.triggerSync(),
    ),
    transactionItems: new TransactionItemRepository(
      storeDb,
      "Transaction_Items",
      () => syncManager.triggerSync(),
    ),
    refunds: dexie<Refund>("Refunds"),
  };
}

export type {
  ILocalRepository,
  IProductRepository,
  IPurchaseOrderItemRepository,
  ITransactionItemRepository,
  ITransactionRepository,
  IVariantRepository,
} from "./LocalRepository";
export type { Role, User } from "./types";
export { AdapterError } from "./types";
export type {
  AuditLog,
  Category,
  Customer,
  Member,
  MonthlySheet,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Refund,
  Setting,
  StockLog,
  Store,
  Transaction,
  TransactionItem,
  Variant,
} from "./zod-schemas";
export type {
  AuthAdapter,
  IDriveClient,
  IRemoteRepository as ISheetRepository,
  Repos,
};

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
  // Stores is a cross-store table — always write to the global __main__ DB
  // so every per-store view sees the same list.
  const db =
    tableName === "Stores"
      ? getDb("__main__")
      : getDb(activeStoreId ?? "__init__");
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
): DexieRepository<Member> {
  const db = getDb(targetStoreId);
  return new DexieRepository<Member>(db, "Members", () =>
    syncManager.triggerSync(),
  );
}
