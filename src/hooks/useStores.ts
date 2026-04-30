import { useQuery } from "@tanstack/react-query";
import { listStores } from "../modules/settings/store-management.service";
import { useAuthStore } from "../store/authStore";

export const STORES_QUERY_KEY_PREFIX = ["stores"] as const;
export const STORES_QUERY_KEY = (mainSpreadsheetId: string | null) =>
  ["stores", mainSpreadsheetId] as const;

/**
 * React Query hook for the current user's store list.
 *
 * Reads from the service layer (→ Dexie in google mode, localStorage in mock
 * mode) so it works offline. The query is automatically refetched after any
 * mutation that calls `queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY })`.
 */
export function useStores() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const mainSpreadsheetId = useAuthStore((s) => s.mainSpreadsheetId);

  return useQuery({
    queryKey: STORES_QUERY_KEY(mainSpreadsheetId),
    queryFn: listStores,
    staleTime: 30_000,
    enabled: !!activeStoreId && !!mainSpreadsheetId,
  });
}
