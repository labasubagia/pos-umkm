import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { getQRISImage } from "../modules/settings/settings.service";

export const QRIS_QUERY_KEY = (storeId: string | null) => ["qris", storeId];

export function useQRISImage() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: QRIS_QUERY_KEY(activeStoreId),
    queryFn: getQRISImage,
    enabled: !!activeStoreId,
  });
}
