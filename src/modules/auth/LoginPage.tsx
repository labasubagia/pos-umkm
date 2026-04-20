/**
 * LoginPage — the entry point for unauthenticated users.
 *
 * `AuthInitializer` (mounted at the root) already calls restoreSession() and
 * populates the Zustand auth store on page load. If the user arrives at /login
 * while already authenticated (persisted state), they are redirected to /cashier
 * immediately via <Navigate> — no effect needed.
 *
 * For a fresh login: signIn() is called, then the user is routed either to
 * /cashier (fast path — spreadsheetId already persisted in Zustand) or /stores
 * (slow path — StorePickerPage resolves the active store).
 *
 * In mock mode (VITE_ADAPTER=mock) restoreSession returns null instantly so
 * the sign-in button is always shown on the first visit.
 */
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { authAdapter } from '../../lib/adapters'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/button'

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, spreadsheetId, setUser, setSpreadsheetId } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  // Already authenticated from persisted Zustand state (e.g. refresh, back-navigation).
  // Guard against the case where we're mid sign-in and isAuthenticated just flipped.
  if (isAuthenticated && !signingIn) {
    return <Navigate to="/cashier" replace />
  }

  /**
   * Navigation after a successful fresh sign-in.
   *
   * Fast path: if masterSpreadsheetId is already persisted in Zustand, restore
   * adapter routing and go straight to /cashier.
   * Slow path: navigate to /stores so StorePickerPage can resolve the store.
   */
  function onAuthenticated(user: Parameters<typeof setUser>[0], token: string) {
    setUser(user, user.role, token)

    const masterId = spreadsheetId ?? localStorage.getItem('masterSpreadsheetId')
    if (masterId) {
      setSpreadsheetId(masterId)
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const monthlyId = localStorage.getItem(`txSheet_${now.getFullYear()}-${mm}`)
      if (monthlyId) useAuthStore.getState().setMonthlySpreadsheetId(monthlyId)
      navigate('/cashier')
    } else {
      navigate('/stores')
    }
  }

  async function handleSignIn() {
    setSigningIn(true)
    try {
      const user = await authAdapter.signIn()
      onAuthenticated(user, authAdapter.getAccessToken() ?? '')
    } catch (err) {
      console.error('[LoginPage] sign-in failed:', err)
      setSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">POS UMKM</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Sistem kasir untuk usaha kecil Indonesia
      </p>
      <Button onClick={() => void handleSignIn()} data-testid="btn-sign-in" disabled={signingIn}>
        {signingIn ? 'Memproses…' : 'Masuk dengan Google'}
      </Button>
    </div>
  )
}
