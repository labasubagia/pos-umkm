/**
 * LoginPage — the entry point for unauthenticated users.
 *
 * `AuthInitializer` (mounted at the root) already calls restoreSession() and
 * populates the Zustand auth store. If the user lands on /login while
 * already authenticated (e.g. browser back-button), they are redirected to
 * /cashier immediately.
 *
 * For a fresh login: signIn() is called, then the user is routed either to
 * /cashier (fast path — masterSpreadsheetId cached in Zustand) or /stores
 * (slow path — StorePickerPage resolves the active store).
 *
 * In mock mode (VITE_ADAPTER=mock) restoreSession returns null instantly so
 * the sign-in button is always shown on the first visit.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { authAdapter, dataAdapter } from '../../lib/adapters'
import { Button } from '../../components/ui/button'

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, spreadsheetId, setUser, setSpreadsheetId } = useAuth()

  // Redirect already-authenticated users (e.g. after page refresh or back-navigation).
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/cashier', { replace: true })
    }
  }, [isAuthenticated, navigate])

  /**
   * Shared navigation logic after any successful fresh sign-in.
   *
   * Fast path: if masterSpreadsheetId is persisted in Zustand, restore the
   * adapter routing and go straight to /cashier (skips StorePickerPage).
   * Slow path: navigate to /stores so StorePickerPage can call findOrCreateMain().
   */
  function onAuthenticated(user: Parameters<typeof setUser>[0], token: string) {
    setUser(user, user.role, token)

    const masterId = spreadsheetId ?? localStorage.getItem('masterSpreadsheetId')
    if (masterId) {
      dataAdapter.setSpreadsheetId(masterId)
      setSpreadsheetId(masterId)
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const monthlyId = localStorage.getItem(`txSheet_${now.getFullYear()}-${mm}`)
      if (monthlyId) dataAdapter.setMonthlySpreadsheetId(monthlyId)
      navigate('/cashier')
    } else {
      navigate('/stores')
    }
  }

  async function handleSignIn() {
    const user = await authAdapter.signIn()
    onAuthenticated(user, authAdapter.getAccessToken() ?? '')
  }

  if (isAuthenticated) return null // Redirect effect is running

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">POS UMKM</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Sistem kasir untuk usaha kecil Indonesia
      </p>
      <Button onClick={() => void handleSignIn()} data-testid="btn-sign-in">Masuk dengan Google</Button>
    </div>
  )
}
