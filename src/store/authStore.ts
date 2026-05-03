import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LS_ACCESS_TOKEN } from "@/api/adapters/google/GoogleAuthAdapter";
import { logger } from "@/utils/logger";
import type { Role, User } from "../api/adapters/types";

interface AuthState {
  user: User | null;
  role: Role | null;
  /** Main spreadsheet ID — one per Google account, shared across all stores (persisted). */
  mainSpreadsheetId: string | null;
  isAuthenticated: boolean;
  activeStoreId: string | null;
  setUser: (user: User, role: Role) => void;
  getAccessToken: () => string | null;
  setMainSpreadsheetId: (id: string) => void;
  setActiveStoreId: (id: string | null) => void;
  clearAuth: () => void;
}

/**
 * Global auth + session store managed by Zustand.
 *
 * Persisted to localStorage via zustand/middleware `persist` so state
 * survives page refreshes. `accessToken` is intentionally excluded from
 * persistence — it is an OAuth bearer token and must never be written to
 * localStorage (XSS risk). The token is restored on startup by
 * AuthInitializer which calls authAdapter.restoreSession().
 *
 * Spreadsheet IDs (master, monthly) are no longer stored here — they live
 * in the store map (storeMapStore.ts) which is populated by traversing the
 * store's Drive folder on activation.
 *
 * activeStoreId is session-only. The authoritative source is the URL /:storeId;
 * AppShell syncs that into Zustand at runtime, so it must not be persisted.
 *
 * The stores list is NOT kept here — it lives in React Query (useStores hook)
 * so mutations auto-invalidate all subscribers without manual setStores() calls.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      mainSpreadsheetId: null,
      isAuthenticated: false,
      activeStoreId: null,
      setUser: (user, role) => set({ user, role, isAuthenticated: true }),
      setMainSpreadsheetId: (id) => set({ mainSpreadsheetId: id }),
      setActiveStoreId: (id) => set({ activeStoreId: id }),
      getAccessToken: () => {
        const token = localStorage.getItem(LS_ACCESS_TOKEN);
        if (!token) {
          logger.error("AuthStore.getAccessToken: no token in store");
          return null;
        }
        return token;
      },
      clearAuth: () =>
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          mainSpreadsheetId: null,
          activeStoreId: null,
        }),
    }),
    {
      name: "pos-umkm-auth",
      storage: createJSONStorage(() => localStorage),
      // Exclude accessToken from persistence — restored at runtime by AuthInitializer.
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        mainSpreadsheetId: state.mainSpreadsheetId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
