/**
 * LoginPage — the entry point for unauthenticated users.
 *
 * On mount, tries to restore a previous GIS session from localStorage (token +
 * expiry stored by GoogleAuthAdapter). If the stored token is still valid the
 * user is sent directly to /cashier or /setup without seeing the login button.
 *
 * In mock mode (VITE_ADAPTER=mock) restoreSession returns null instantly so
 * the sign-in button is always shown.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { authAdapter, dataAdapter } from '../../lib/adapters'
import { Button } from '../../components/ui/button'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setSpreadsheetId } = useAuth()
  const [restoring, setRestoring] = useState(true)

  /** Shared navigation logic after any successful auth (restore or fresh sign-in). */
  function onAuthenticated(user: Parameters<typeof setUser>[0], token: string) {
    setUser(user, user.role, token)
    const existingId = dataAdapter.getSpreadsheetId('master')
    if (existingId) {
      dataAdapter.setSpreadsheetId(existingId)
      setSpreadsheetId(existingId)
      // Restore monthly sheet routing if a monthly sheet exists for this month.
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const monthlyId = localStorage.getItem(`txSheet_${now.getFullYear()}-${mm}`)
      if (monthlyId) dataAdapter.setMonthlySpreadsheetId(monthlyId)
      navigate('/cashier')
    } else {
      navigate('/setup')
    }
  }

  // Try to restore from localStorage on mount — avoids OAuth popup on refresh.
  useEffect(() => {
    void authAdapter.restoreSession().then((user) => {
      if (user) {
        onAuthenticated(user, authAdapter.getAccessToken() ?? '')
      } else {
        setRestoring(false)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    const user = await authAdapter.signIn()
    onAuthenticated(user, authAdapter.getAccessToken() ?? '')
  }

  if (restoring) return null // Brief flash while checking localStorage

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
