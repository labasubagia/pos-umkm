import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

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
