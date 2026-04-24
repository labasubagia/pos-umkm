import { useQuery } from "@tanstack/react-query";
import { fetchPurchaseOrders } from "../modules/inventory/inventory.service";
import { useAuthStore } from "../store/authStore";

export const PURCHASE_ORDERS_QUERY_KEY = (storeId: string | null) => [
  "purchase-orders",
  storeId,
];

export function usePurchaseOrders() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: PURCHASE_ORDERS_QUERY_KEY(activeStoreId),
    queryFn: fetchPurchaseOrders,
    enabled: !!activeStoreId,
  });
}
