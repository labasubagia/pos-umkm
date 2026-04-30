import { useLiveQuery } from "dexie-react-hooks";
import type { StoreRecord } from "../modules/auth/setup.service";
import { listStores } from "../modules/settings/store-management.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat — no longer used for cache invalidation.
export const STORES_QUERY_KEY_PREFIX = ["stores"] as const;
export const STORES_QUERY_KEY = (mainSpreadsheetId: string | null) =>
  ["stores", mainSpreadsheetId] as const;

/**
 * Reactive hook for the current user's store list.
 *
 * Subscribes to Dexie (IndexedDB) via useLiveQuery so the component
 * re-renders automatically whenever any code path writes to the Stores
 * table — no invalidateQueries() wiring needed.
 */
export function useStores() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? listStores() : Promise.resolve([] as StoreRecord[])),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as StoreRecord[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
