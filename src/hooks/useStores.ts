import { useQuery } from "@tanstack/react-query";
import { listStores } from "../modules/settings/store-management.service";

export const STORES_QUERY_KEY = ["stores"] as const;

/**
 * React Query hook for the current user's store list.
 *
 * Reads from the service layer (→ Dexie in google mode, localStorage in mock
 * mode) so it works offline. The query is automatically refetched after any
 * mutation that calls `queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY })`.
 */
export function useStores() {
  return useQuery({
    queryKey: STORES_QUERY_KEY,
    queryFn: listStores,
    staleTime: 30_000,
  });
}
