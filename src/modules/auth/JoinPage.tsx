/**
 * JoinPage — landing page for members who open a Store Link.
 *
 * The Store Link format: /join?sid=<spreadsheetId>
 *
 * Flow:
 * 1. Extract `sid` from URL query params.
 * 2. Persist the spreadsheetId to localStorage (so the adapter uses it).
 * 3. Show a "Sign in with Google" button.
 * 4. After sign-in, resolve the user's role from the Users tab.
 * 5. Navigate to /cashier.
 *
 * Members only need the `spreadsheets` scope — they access a sheet shared
 * with them, not one they created. The adapter handles scope selection.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { authAdapter } from '../../lib/adapters'
import { useAuth } from './useAuth'
import { resolveUserRole } from './auth.service'

export default function JoinPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { setUser, setSpreadsheetId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sid = params.get('sid')

  useEffect(() => {
    // Persist the spreadsheetId immediately — before the user signs in —
    // so the adapter is ready when auth completes.
    if (sid) {
      localStorage.setItem('masterSpreadsheetId', sid)
    }
  }, [sid])

  async function handleJoin() {
    if (!sid) {
      setError('Tautan toko tidak valid. Minta tautan baru dari pemilik toko.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const user = await authAdapter.signIn()
      const role = await resolveUserRole(user.email)
      const userWithRole = { ...user, role }
      const token = authAdapter.getAccessToken() ?? ''
      setUser(userWithRole, role, token)
      setSpreadsheetId(sid)
      navigate('/cashier')
    } catch (err) {
      setError(`Gagal bergabung: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold" data-testid="join-page-heading">Bergabung ke Toko</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Anda diundang untuk mengakses toko ini. Masuk dengan akun Google Anda untuk melanjutkan.
      </p>
      {error && <p className="text-red-500 text-sm max-w-sm text-center">{error}</p>}
      <Button onClick={() => void handleJoin()} disabled={loading} data-testid="btn-join-sign-in">
        {loading ? 'Memuat...' : 'Masuk dengan Google'}
      </Button>
    </div>
  )
}
