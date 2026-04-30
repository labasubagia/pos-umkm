import { useLiveQuery } from "dexie-react-hooks";
import type { Variant } from "../modules/catalog/catalog.service";
import { fetchVariants } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const VARIANTS_QUERY_KEY = (storeId: string | null) => [
  "variants",
  storeId,
];

export function useVariants() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? fetchVariants() : Promise.resolve([] as Variant[])),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as Variant[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
