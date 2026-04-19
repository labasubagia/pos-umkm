/**
 * AuthInitializer — restores OAuth token + data adapter routing on every page load.
 *
 * Zustand `persist` middleware rehydrates user, role, stores, isAuthenticated,
 * and spreadsheetId from localStorage. Two things it cannot restore:
 *
 *   1. accessToken — intentionally excluded for XSS safety. Restored by
 *      calling authAdapter.restoreSession().
 *   2. In-memory adapter routing — dataAdapter keeps its spreadsheetId in
 *      memory and loses it on refresh. Restored from the persisted
 *      spreadsheetId and the txSheet_* key in localStorage.
 *
 * Behaviour matrix:
 *   - Valid session   → setAccessToken(); restore adapter routing.
 *   - Expired session + Google → clearAuth() → ProtectedRoute → /login.
 *   - Expired session + mock  → keep persisted state (dev convenience).
 *
 * Renders children immediately — ProtectedRoute guards protected pages via
 * isAuthenticated from the persisted store.
 */
import { useEffect, type ReactNode } from 'react'
import { authAdapter, dataAdapter } from '../lib/adapters'
import { useAuth } from '../modules/auth/useAuth'

const IS_MOCK = import.meta.env.VITE_ADAPTER !== 'google'

interface Props {
  children: ReactNode
}

export function AuthInitializer({ children }: Props) {
  const { isAuthenticated, spreadsheetId, setAccessToken, clearAuth } = useAuth()

  useEffect(() => {
    // Restore in-memory adapter routing from persisted state so API calls
    // work immediately after a page refresh (before any user interaction).
    if (spreadsheetId) {
      dataAdapter.setSpreadsheetId(spreadsheetId)
      // Monthly transaction sheet is still stored directly in localStorage by
      // setup.service (not yet moved to Zustand).
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const monthlyId = localStorage.getItem(`txSheet_${now.getFullYear()}-${mm}`)
      if (monthlyId) dataAdapter.setMonthlySpreadsheetId(monthlyId)
    }

    void authAdapter.restoreSession().then((user) => {
      if (user) {
        // Session is valid — inject token so Google API calls are authorised.
        const token = authAdapter.getAccessToken()
        if (token) setAccessToken(token)
      } else if (isAuthenticated && !IS_MOCK) {
        // Google token expired / revoked — wipe persisted auth.
        clearAuth()
      }
      // Mock: restoreSession always returns null; leave persisted state intact
      // so developers stay logged in across hot-reloads.
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
