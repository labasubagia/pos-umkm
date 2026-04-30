import { useLiveQuery } from "dexie-react-hooks";
import type { OpnameRow } from "../modules/inventory/inventory.service";
import { fetchStockOpnameData } from "../modules/inventory/inventory.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const STOCK_OPNAME_QUERY_KEY = (storeId: string | null) => [
  "stock-opname",
  storeId,
];

export function useStockOpname() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () =>
      activeStoreId
        ? fetchStockOpnameData()
        : Promise.resolve([] as OpnameRow[]),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as OpnameRow[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
