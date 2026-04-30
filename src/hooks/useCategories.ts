import { useLiveQuery } from "dexie-react-hooks";
import type { Category } from "../modules/catalog/catalog.service";
import { fetchCategories } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const CATEGORIES_QUERY_KEY = (storeId: string | null) => [
  "categories",
  storeId,
];

export function useCategories() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () =>
      activeStoreId ? fetchCategories() : Promise.resolve([] as Category[]),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as Category[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
