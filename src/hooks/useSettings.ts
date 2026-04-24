import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../modules/settings/settings.service";
import { useAuthStore } from "../store/authStore";

export const SETTINGS_QUERY_KEY = (storeId: string | null) => [
  "settings",
  storeId,
];

export function useSettings() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY(activeStoreId),
    queryFn: getSettings,
    enabled: !!activeStoreId,
  });
}
