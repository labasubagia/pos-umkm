import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

export const PRODUCTS_QUERY_KEY = (storeId: string | null) => [
  "products",
  storeId,
];

export function useProducts() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY(activeStoreId),
    queryFn: fetchProducts,
    enabled: !!activeStoreId,
  });
}
