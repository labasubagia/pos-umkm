import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { fetchCustomers } from "../modules/customers/customers.service";

export const CUSTOMERS_QUERY_KEY = (storeId: string | null) => [
  "customers",
  storeId,
];

export function useCustomers() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: CUSTOMERS_QUERY_KEY(activeStoreId),
    queryFn: fetchCustomers,
    enabled: !!activeStoreId,
  });
}
