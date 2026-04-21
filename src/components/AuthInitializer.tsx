/**
 * AuthInitializer — restores OAuth token on every page load.
 *
 * Zustand `persist` middleware rehydrates user, role, isAuthenticated,
 * spreadsheetId, and activeStoreId from localStorage. Two things it cannot restore:
 *
 *   1. accessToken — intentionally excluded for XSS safety. Restored by
 *      calling authAdapter.restoreSession() in a useEffect.
 *   2. In-memory adapter routing — getRepos() now reads IDs from Zustand
 *      on every call, so there is nothing to restore here.
 *
 * Adapter routing is restored SYNCHRONOUSLY before children render so that
 * page-level effects (e.g. CashierPage loading products) can make API calls
 * immediately without racing against this component's useEffect.
 *
 * Renders children immediately — ProtectedRoute guards protected pages via
 * isAuthenticated from the persisted store.
 *
 * Token restoration race condition fix:
 * GoogleAuthAdapter.restoreSession() reads localStorage only (no network call,
 * no await). Calling it synchronously in the render body — before returning
 * children — ensures getToken() returns a valid token when child useEffects
 * fire their first API call after page refresh.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { authAdapter, resetDexieLayer } from '../lib/adapters'
import { useAuth } from '../modules/auth/useAuth'

interface Props {
  children: ReactNode
}

export function AuthInitializer({ children }: Props) {
  const { isAuthenticated, setAccessToken, clearAuth } = useAuth()

  // ── Synchronous token restoration ───────────────────────────────────────────
  if (!authAdapter.getAccessToken()) {
    void authAdapter.restoreSession()
  }

  // ── Async Zustand sync + expiry check ──────────────────────────────────────
  const sessionRestored = useRef(false)
  useEffect(() => {
    if (sessionRestored.current) return
    sessionRestored.current = true
    void authAdapter.restoreSession().then((user) => {
      if (user) {
        const token = authAdapter.getAccessToken()
        if (token) setAccessToken(token)
      } else if (isAuthenticated) {
        // Google token expired / revoked — wipe persisted auth and release DBs.
        resetDexieLayer()
        clearAuth()
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
