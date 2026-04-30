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
import { useAuthStore } from "./authStore";

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

type StoreMapStore = ReturnType<typeof createStoreMapStore>;

const storeMapStores = new Map<string, StoreMapStore>();

/**
 * Returns the persisted store map store for a specific store ID.
 * Store instances are memoized in-memory so callers share one zustand store
 * per store while persistence remains isolated per localStorage key.
 */
export function getStoreMapStore(storeId: string): StoreMapStore {
  const existing = storeMapStores.get(storeId);
  if (existing) return existing;

  const created = createStoreMapStore(storeId);
  storeMapStores.set(storeId, created);
  return created;
}

/**
 * Returns the current store map using the derived active store context.
 * The route is authoritative; authStore mirrors the URL in AppShell.
 * When authStore has not synced yet (e.g. very early bootstrap), fall back
 * to parsing the current browser path.
 */
export function getCurrentStoreMapStore(): StoreMapStore {
  const storeId = useAuthStore.getState().activeStoreId ?? getStoreIdFromUrl();
  if (!storeId) {
    throw new Error("storeMapStore: no current store in auth state or URL");
  }
  return getStoreMapStore(storeId);
}

export function resetStoreMapStore(storeId?: string): void {
  if (storeId) {
    storeMapStores.delete(storeId);
    return;
  }

  storeMapStores.clear();
}

function getStoreIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const segments = window.location.pathname.split("/").filter(Boolean);
  const routeSegments =
    segments[0] === "pos-umkm" ? segments.slice(1) : segments;
  const candidate = routeSegments[0];

  if (!candidate) return null;
  if (["login", "join", "setup", "stores"].includes(candidate)) {
    return null;
  }

  return candidate;
}
