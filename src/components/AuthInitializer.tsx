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
 *
 * Proactive token refresh:
 * After restoring a session, a setTimeout fires 5 minutes before expiry and
 * silently requests a fresh token (no popup). On success it resets any outbox
 * entries that failed due to the expired token and reschedules for the new
 * token's lifetime. On failure it clears auth so the user is sent back to
 * the login page.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { authAdapter, resetDexieLayer, syncManager } from '../lib/adapters'
import { GoogleAuthAdapter } from '../lib/adapters/google/GoogleAuthAdapter'
import { useAuth } from '../modules/auth/useAuth'
import { useAuthStore } from '../store/authStore'

interface Props {
  children: ReactNode
}

export function AuthInitializer({ children }: Props) {
  const { setAccessToken, clearAuth } = useAuth()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Synchronous token restoration ───────────────────────────────────────────
  if (!authAdapter.getAccessToken()) {
    void authAdapter.restoreSession()
  }

  // ── Async Zustand sync + expiry check + proactive refresh ──────────────────
  const sessionRestored = useRef(false)
  useEffect(() => {
    if (sessionRestored.current) return
    sessionRestored.current = true

    const gAuth = authAdapter as GoogleAuthAdapter

    const planRefresh = () => {
      const expiry = gAuth.getTokenExpiry()
      if (!expiry) return
      // Refresh 5 minutes before the token expires; enforce a 30 s floor so we
      // don't spin if expiry is already very close.
      const delay = Math.max(expiry - Date.now() - 5 * 60_000, 30_000)
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(async () => {
        const ok = await gAuth.silentRefresh()
        if (ok) {
          const token = gAuth.getAccessToken()
          if (token) setAccessToken(token)
          // Unblock any outbox entries that failed due to an expired token.
          await syncManager.resetFailedEntries()
          planRefresh() // reschedule for the new token's lifetime
        } else if (useAuthStore.getState().isAuthenticated) {
          resetDexieLayer()
          clearAuth()
        }
      }, delay)
    }

    void gAuth.restoreSession().then((user) => {
      if (user) {
        const token = gAuth.getAccessToken()
        if (token) setAccessToken(token)
        planRefresh()
      } else if (useAuthStore.getState().isAuthenticated) {
        // Google token expired / revoked — wipe persisted auth and release DBs.
        resetDexieLayer()
        clearAuth()
      }
    })

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
