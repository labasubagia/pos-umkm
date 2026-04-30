import { useLiveQuery } from "dexie-react-hooks";
import type { PurchaseOrder } from "../modules/inventory/inventory.service";
import { fetchPurchaseOrders } from "../modules/inventory/inventory.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const PURCHASE_ORDERS_QUERY_KEY = (storeId: string | null) => [
  "purchase-orders",
  storeId,
];

export function usePurchaseOrders() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () =>
      activeStoreId
        ? fetchPurchaseOrders()
        : Promise.resolve([] as PurchaseOrder[]),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as PurchaseOrder[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
