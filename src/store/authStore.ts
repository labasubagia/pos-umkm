import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Role, User } from "../lib/adapters/types";

interface AuthState {
  user: User | null;
  role: Role | null;
  /** In-memory only — never written to localStorage to prevent XSS token theft. */
  accessToken: string | null;
  /** Main spreadsheet ID — one per Google account, shared across all stores (persisted). */
  mainSpreadsheetId: string | null;
  isAuthenticated: boolean;
  activeStoreId: string | null;
  setUser: (user: User, role: Role, accessToken: string) => void;
  setAccessToken: (token: string) => void;
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
      accessToken: null,
      mainSpreadsheetId: null,
      isAuthenticated: false,
      activeStoreId: null,
      setUser: (user, role, accessToken) =>
        set({ user, role, accessToken, isAuthenticated: true }),
      setAccessToken: (token) => set({ accessToken: token }),
      setMainSpreadsheetId: (id) => set({ mainSpreadsheetId: id }),
      setActiveStoreId: (id) => set({ activeStoreId: id }),
      clearAuth: () =>
        set({
          user: null,
          role: null,
          accessToken: null,
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
