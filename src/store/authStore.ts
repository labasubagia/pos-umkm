import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Role, User } from '../lib/adapters/types'
import type { StoreRecord } from '../modules/auth/setup.service'

interface AuthState {
  user: User | null
  role: Role | null
  /** In-memory only — never written to localStorage to prevent XSS token theft. */
  accessToken: string | null
  spreadsheetId: string | null
  isAuthenticated: boolean
  stores: StoreRecord[]
  activeStoreId: string | null
  setUser: (user: User, role: Role, accessToken: string) => void
  setAccessToken: (token: string) => void
  setSpreadsheetId: (id: string) => void
  setStores: (stores: StoreRecord[], activeStoreId: string | null) => void
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
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      accessToken: null,
      spreadsheetId: null,
      isAuthenticated: false,
      stores: [],
      activeStoreId: null,
      setUser: (user, role, accessToken) =>
        set({ user, role, accessToken, isAuthenticated: true }),
      setAccessToken: (token) => set({ accessToken: token }),
      setSpreadsheetId: (id) => set({ spreadsheetId: id }),
      setStores: (stores, activeStoreId) => set({ stores, activeStoreId }),
      clearAuth: () =>
        set({
          user: null,
          role: null,
          accessToken: null,
          isAuthenticated: false,
          stores: [],
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
        isAuthenticated: state.isAuthenticated,
        stores: state.stores,
        activeStoreId: state.activeStoreId,
      }),
    },
  ),
)
