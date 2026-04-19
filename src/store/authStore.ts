import { create } from 'zustand'
import type { Role, User } from '../lib/adapters/types'
import type { StoreRecord } from '../modules/auth/setup.service'

interface AuthState {
  user: User | null
  role: Role | null
  accessToken: string | null
  spreadsheetId: string | null
  isAuthenticated: boolean
  stores: StoreRecord[]
  activeStoreId: string | null
  setUser: (user: User, role: Role, accessToken: string) => void
  setSpreadsheetId: (id: string) => void
  setStores: (stores: StoreRecord[], activeStoreId: string | null) => void
  clearAuth: () => void
}

/**
 * Global auth state store using Zustand.
 * Access token is held in memory only — never persisted to localStorage
 * to prevent XSS token theft.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  accessToken: null,
  spreadsheetId: null,
  isAuthenticated: false,
  stores: [],
  activeStoreId: null,
  setUser: (user, role, accessToken) => set({ user, role, accessToken, isAuthenticated: true }),
  setSpreadsheetId: (id) => set({ spreadsheetId: id }),
  setStores: (stores, activeStoreId) => set({ stores, activeStoreId }),
  clearAuth: () => set({
    user: null,
    role: null,
    accessToken: null,
    isAuthenticated: false,
    stores: [],
    activeStoreId: null,
  }),
}))
