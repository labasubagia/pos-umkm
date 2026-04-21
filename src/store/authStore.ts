import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Role, User } from '../lib/adapters/types'

interface AuthState {
  user: User | null
  role: Role | null
  /** In-memory only — never written to localStorage to prevent XSS token theft. */
  accessToken: string | null
  /** Master spreadsheet ID for the active store (persisted). */
  spreadsheetId: string | null
  /** Main spreadsheet ID — one per Google account, shared across all stores (persisted). */
  mainSpreadsheetId: string | null
  /** Current month's transaction spreadsheet ID (persisted). */
  monthlySpreadsheetId: string | null
  isAuthenticated: boolean
  activeStoreId: string | null
  setUser: (user: User, role: Role, accessToken: string) => void
  setAccessToken: (token: string) => void
  setSpreadsheetId: (id: string) => void
  setMainSpreadsheetId: (id: string) => void
  setMonthlySpreadsheetId: (id: string) => void
  setActiveStoreId: (id: string | null) => void
  /**
   * Atomically updates spreadsheetId, monthlySpreadsheetId, and activeStoreId
   * in a single Zustand set() call — preventing AppShell from seeing partial
   * state (e.g. new spreadsheetId with old activeStoreId) that would cause
   * hydration to write the wrong store's data into the wrong Dexie database.
   */
  setStoreSession: (
    spreadsheetId: string,
    monthlySpreadsheetId: string | null,
    activeStoreId: string,
  ) => void
  clearAuth: () => void
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
 * The stores list is NOT kept here — it lives in React Query (useStores hook)
 * so mutations auto-invalidate all subscribers without manual setStores() calls.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      accessToken: null,
      spreadsheetId: null,
      mainSpreadsheetId: null,
      monthlySpreadsheetId: null,
      isAuthenticated: false,
      activeStoreId: null,
      setUser: (user, role, accessToken) =>
        set({ user, role, accessToken, isAuthenticated: true }),
      setAccessToken: (token) => set({ accessToken: token }),
      setSpreadsheetId: (id) => set({ spreadsheetId: id }),
      setMainSpreadsheetId: (id) => set({ mainSpreadsheetId: id }),
      setMonthlySpreadsheetId: (id) => set({ monthlySpreadsheetId: id }),
      setActiveStoreId: (id) => set({ activeStoreId: id }),
      setStoreSession: (spreadsheetId, monthlySpreadsheetId, activeStoreId) =>
        set({ spreadsheetId, monthlySpreadsheetId, activeStoreId }),
      clearAuth: () =>
        set({
          user: null,
          role: null,
          accessToken: null,
          isAuthenticated: false,
          spreadsheetId: null,
          mainSpreadsheetId: null,
          monthlySpreadsheetId: null,
          activeStoreId: null,
        }),
    }),
    {
      name: 'pos-umkm-auth',
      storage: createJSONStorage(() => localStorage),
      // Exclude accessToken from persistence — restored at runtime by AuthInitializer.
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        spreadsheetId: state.spreadsheetId,
        mainSpreadsheetId: state.mainSpreadsheetId,
        monthlySpreadsheetId: state.monthlySpreadsheetId,
        isAuthenticated: state.isAuthenticated,
        activeStoreId: state.activeStoreId,
      }),
    },
  ),
)
