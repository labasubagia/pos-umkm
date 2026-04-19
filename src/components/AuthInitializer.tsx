/**
 * AuthInitializer — restores OAuth token + data adapter routing on every page load.
 *
 * Zustand `persist` middleware rehydrates user, role, stores, isAuthenticated,
 * and spreadsheetId from localStorage. Two things it cannot restore:
 *
 *   1. accessToken — intentionally excluded for XSS safety. Restored by
 *      calling authAdapter.restoreSession() in a useEffect.
 *   2. In-memory adapter routing — dataAdapter keeps its spreadsheetId in
 *      memory and loses it on refresh.
 *
 * Adapter routing is restored SYNCHRONOUSLY before children render so that
 * page-level effects (e.g. CashierPage loading products) can make API calls
 * immediately without racing against this component's useEffect.
 *
 * Behaviour matrix:
 *   - Valid session   → setAccessToken(); adapter already wired synchronously.
 *   - Expired session + Google → clearAuth() → ProtectedRoute → landing page.
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

  // ── Synchronous adapter wiring ──────────────────────────────────────────────
  // Restore in-memory dataAdapter routing from persisted Zustand state BEFORE
  // children render, so child useEffects that load page data don't get a null
  // spreadsheetId. This is safe to call during render because it is a
  // non-React side effect (no setState, no DOM mutation).
  if (spreadsheetId) {
    dataAdapter.setSpreadsheetId(spreadsheetId)
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const monthlyId = localStorage.getItem(`txSheet_${now.getFullYear()}-${mm}`)
    if (monthlyId) dataAdapter.setMonthlySpreadsheetId(monthlyId)
  }

  // ── Async token restoration ─────────────────────────────────────────────────
  useEffect(() => {
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
