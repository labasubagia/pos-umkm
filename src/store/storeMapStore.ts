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
import type { SheetMeta } from "../lib/adapters/StoreFolderService";

interface StoreMapState {
  /** The store's root Drive folder ID. */
  storeFolderId: string | null;
  /** Flattened sheet map: sheet_name → SheetMeta. */
  sheets: Record<string, SheetMeta>;
  /** Epoch ms of last successful traversal. */
  lastTraversedAt: number | null;

  // Actions
  setStoreMap: (
    storeFolderId: string,
    sheets: Record<string, SheetMeta>,
  ) => void;
  getSheetMeta: (sheetName: string) => SheetMeta | undefined;
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
        lastTraversedAt: null,

        setStoreMap: (storeFolderId, sheets) =>
          set({
            storeFolderId,
            sheets,
            lastTraversedAt: Date.now(),
          }),

        getSheetMeta: (sheetName: string) => {
          return get().sheets[sheetName];
        },

        clearStoreMap: () =>
          set({
            storeFolderId: null,
            sheets: {},
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

export function getActiveStoreMap(): ReturnType<typeof createStoreMapStore> {
  if (!_activeStoreMap) {
    throw new Error(
      "storeMapStore: no active store — call setActiveStoreMap(storeId) first",
    );
  }
  return _activeStoreMap;
}

export function resetActiveStoreMap(): void {
  _activeStoreMap = null;
}
