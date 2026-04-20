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
 *
 * Token restoration race condition fix:
 * GoogleAuthAdapter.restoreSession() reads localStorage only (no network call,
 * no await). Calling it synchronously in the render body — before returning
 * children — ensures getToken() returns a valid token when child useEffects
 * fire their first API call after page refresh. The useEffect below handles
 * Zustand sync + expired-session redirect separately.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { authAdapter } from '../lib/adapters'
import { useAuth } from '../modules/auth/useAuth'

const IS_MOCK = import.meta.env.VITE_ADAPTER !== 'google'

interface Props {
  children: ReactNode
}

export function AuthInitializer({ children }: Props) {
  const { isAuthenticated, setAccessToken, clearAuth } = useAuth()

  // ── Adapter IDs are now read from Zustand by getRepos() on every call ─────────
  // No need to imperatively wire the adapter — getRepos() reads spreadsheetId
  // and monthlySpreadsheetId from the auth store at call time.

  // ── Synchronous token restoration ───────────────────────────────────────────
  // restoreSession() reads localStorage only (no await), so calling it in the
  // render body is safe. This ensures authAdapter.getAccessToken() returns a
  // valid token when child useEffects fire their first API call after a page
  // refresh — avoiding the 403 "unregistered caller" race condition.
  if (!IS_MOCK && !authAdapter.getAccessToken()) {
    void authAdapter.restoreSession()
  }

  // ── Async Zustand sync + expiry check ──────────────────────────────────────
  const sessionRestored = useRef(false)
  useEffect(() => {
    if (sessionRestored.current) return
    sessionRestored.current = true
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
