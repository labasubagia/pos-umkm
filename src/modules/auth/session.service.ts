import { resetDexieLayer } from "../../api/adapters";
import { queryClient } from "../../hooks/queryClient";
import { useAuthStore } from "../../store/authStore";
import { resetStoreMapStore } from "../../store/storeMapStore";
import { clearSetupStorage } from "./setup.service";

/**
 * Clears all local session state so the next login starts from a clean,
 * consistent bootstrap path regardless of how sign-out was triggered.
 */
export async function clearSessionState(): Promise<void> {
  await resetDexieLayer();
  useAuthStore.getState().clearAuth();
  resetStoreMapStore();
  clearSetupStorage();
  queryClient.clear();
}
