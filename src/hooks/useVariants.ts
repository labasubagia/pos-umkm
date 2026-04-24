import { useQuery } from "@tanstack/react-query";
import { fetchVariants } from "../modules/catalog/catalog.service";
import { useAuthStore } from "../store/authStore";

export const VARIANTS_QUERY_KEY = (storeId: string | null) => [
  "variants",
  storeId,
];

export function useVariants() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: VARIANTS_QUERY_KEY(activeStoreId),
    queryFn: fetchVariants,
    enabled: !!activeStoreId,
  });
}
