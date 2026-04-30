import { useLiveQuery } from "dexie-react-hooks";
import type { BusinessSettings } from "../modules/settings/settings.service";
import { getSettings } from "../modules/settings/settings.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const SETTINGS_QUERY_KEY = (storeId: string | null) => [
  "settings",
  storeId,
];

const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: "POS UMKM",
  tax_rate: 11,
  receipt_footer: "Terima kasih sudah berbelanja!",
  qris_image_url: "",
};

export function useSettings() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? getSettings() : Promise.resolve(DEFAULT_SETTINGS)),
    [activeStoreId],
  );
  return {
    data: result ?? undefined,
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
