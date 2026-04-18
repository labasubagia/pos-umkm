import { create } from 'zustand'

type Role = 'owner' | 'manager' | 'cashier' | null

interface User {
  id: string
  email: string
  name: string
}

interface AuthState {
  user: User | null
  role: Role
  accessToken: string | null
  spreadsheetId: string | null
  isAuthenticated: boolean
  setUser: (user: User, role: Role, accessToken: string) => void
  setSpreadsheetId: (id: string) => void
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
  setUser: (user, role, accessToken) => set({ user, role, accessToken, isAuthenticated: true }),
  setSpreadsheetId: (id) => set({ spreadsheetId: id }),
  clearAuth: () => set({ user: null, role: null, accessToken: null, isAuthenticated: false }),
}))
