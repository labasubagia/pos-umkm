/**
 * LoginPage — the entry point for unauthenticated users.
 *
 * Renders a "Sign in with Google" button that calls the active AuthAdapter.
 * In mock mode (VITE_ADAPTER=mock) this resolves instantly with the preset
 * owner user. In google mode it opens the GIS OAuth popup.
 *
 * On success the user is stored in the Zustand auth store and the router
 * navigates to /setup (first-time owner) or /cashier (returning user).
 */
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { authAdapter, dataAdapter } from '../../lib/adapters'
import { Button } from '../../components/ui/button'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setSpreadsheetId } = useAuth()

  async function handleSignIn() {
    const user = await authAdapter.signIn()
    const token = authAdapter.getAccessToken() ?? ''
    setUser(user, user.role, token)

    // Check whether this user already has a master spreadsheet stored locally.
    const existingId = dataAdapter.getSpreadsheetId('master')
    if (existingId) {
      setSpreadsheetId(existingId)
      navigate('/cashier')
    } else {
      navigate('/setup')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">POS UMKM</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Sistem kasir untuk usaha kecil Indonesia
      </p>
      <Button onClick={handleSignIn}>Masuk dengan Google</Button>
    </div>
  )
}
