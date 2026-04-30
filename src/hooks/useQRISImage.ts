import { useLiveQuery } from "dexie-react-hooks";
import { getQRISImage } from "../modules/settings/settings.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const QRIS_QUERY_KEY = (storeId: string | null) => ["qris", storeId];

export function useQRISImage() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? getQRISImage() : Promise.resolve("")),
    [activeStoreId],
  );
  return {
    data: result ?? "",
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
