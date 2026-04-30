import { useLiveQuery } from "dexie-react-hooks";
import type { Product } from "../modules/catalog/catalog.service";
import { fetchProducts } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const PRODUCTS_QUERY_KEY = (storeId: string | null) => [
  "products",
  storeId,
];

export function useProducts() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? fetchProducts() : Promise.resolve([] as Product[])),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as Product[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
