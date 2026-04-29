/**
 * storeMapStore.ts — Zustand store for the per-store sheet map.
 *
 * Persists the flattened Drive folder traversal result to localStorage so
 * the app can start offline. Keyed by store_id so multiple stores can
 * coexist on the same device.
 *
 * Key format: pos_umkm_storemap_<store_id>
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  MonthlySheetMeta,
  SheetMeta,
} from "../lib/adapters/StoreFolderService";

interface StoreMapState {
  /** The store's root Drive folder ID. */
  storeFolderId: string | null;
  /** Non-transaction sheets: sheet_name → SheetMeta (master, main). */
  sheets: Record<string, SheetMeta>;
  /** Monthly transaction spreadsheets (array — one per month). */
  monthlySheets: MonthlySheetMeta[];
  /** Epoch ms of last successful traversal. */
  lastTraversedAt: number | null;

  // Actions
  setStoreMap: (
    storeFolderId: string,
    sheets: Record<string, SheetMeta>,
    monthlySheets: MonthlySheetMeta[],
  ) => void;
  getSheetMeta: (sheetName: string) => SheetMeta | undefined;
  getCurrentMonthSheets: () => Record<string, SheetMeta> | undefined;
  clearStoreMap: () => void;
}

/**
 * Creates a persisted zustand store for a specific store_id.
 * Each store gets its own localStorage key: pos_umkm_storemap_<storeId>.
 */
export function createStoreMapStore(storeId: string) {
  return create<StoreMapState>()(
    persist(
      (set, get) => ({
        storeFolderId: null,
        sheets: {},
        monthlySheets: [],
        lastTraversedAt: null,

        setStoreMap: (storeFolderId, sheets, monthlySheets) =>
          set({
            storeFolderId,
            sheets,
            monthlySheets,
            lastTraversedAt: Date.now(),
          }),

        getSheetMeta: (sheetName: string) => {
          return get().sheets[sheetName];
        },

        /**
         * Returns the sheet map for the current month's transaction spreadsheet,
         * or undefined if no monthly sheet exists for the current month.
         */
        getCurrentMonthSheets: () => {
          const now = new Date();
          const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          return get().monthlySheets.find((m) => m.yearMonth === yearMonth)
            ?.sheets;
        },

        clearStoreMap: () =>
          set({
            storeFolderId: null,
            sheets: {},
            monthlySheets: [],
            lastTraversedAt: null,
          }),
      }),
      {
        name: `pos_umkm_storemap_${storeId}`,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  );
}

/**
 * Singleton store instance — set by setActiveStoreMap() when the user
 * activates a store. Feature modules import this.
 */
let _activeStoreMap: ReturnType<typeof createStoreMapStore> | null = null;

export function setActiveStoreMap(storeId: string): void {
  _activeStoreMap = createStoreMapStore(storeId);
}

/**
 * Returns the active store map. If not yet initialized, auto-initializes
 * from the activeStoreId in localStorage (handles page refresh where
 * activateStore hasn't been called yet but the persisted store map exists).
 */
export function getActiveStoreMap(): ReturnType<typeof createStoreMapStore> {
  if (!_activeStoreMap) {
    // Auto-initialize from localStorage (authStore persists activeStoreId)
    try {
      const authRaw = localStorage.getItem("pos-umkm-auth");
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        const storeId = auth?.state?.activeStoreId;
        if (storeId) {
          _activeStoreMap = createStoreMapStore(storeId);
          return _activeStoreMap;
        }
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(
      "storeMapStore: no active store — call setActiveStoreMap(storeId) first",
    );
  }
  return _activeStoreMap;
}

export function resetActiveStoreMap(): void {
  _activeStoreMap = null;
}
