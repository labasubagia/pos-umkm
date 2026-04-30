import { useLiveQuery } from "dexie-react-hooks";
import type { Customer } from "../modules/customers/customers.service";
import { fetchCustomers } from "../modules/customers/customers.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const CUSTOMERS_QUERY_KEY = (storeId: string | null) => [
  "customers",
  storeId,
];

export function useCustomers() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () =>
      activeStoreId ? fetchCustomers() : Promise.resolve([] as Customer[]),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as Customer[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
