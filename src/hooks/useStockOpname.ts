import { useQuery } from "@tanstack/react-query";
import { fetchStockOpnameData } from "../modules/inventory/inventory.service";
import { useAuthStore } from "../store/authStore";

export const STOCK_OPNAME_QUERY_KEY = (storeId: string | null) => [
  "stock-opname",
  storeId,
];

export function useStockOpname() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: STOCK_OPNAME_QUERY_KEY(activeStoreId),
    queryFn: fetchStockOpnameData,
    enabled: !!activeStoreId,
  });
}
