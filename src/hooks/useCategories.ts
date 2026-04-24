import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { fetchCategories } from "../modules/catalog/catalog.service";

export const CATEGORIES_QUERY_KEY = (storeId: string | null) => [
  "categories",
  storeId,
];

export function useCategories() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY(activeStoreId),
    queryFn: fetchCategories,
    enabled: !!activeStoreId,
  });
}
