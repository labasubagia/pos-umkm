/**
 * StorePickerPage — resolves which store to activate after every login.
 *
 * On mount:
 *   1. Calls findOrCreateMain() to get (or create) the owner's main spreadsheet.
 *   2. If 0 stores → redirects to /setup (first-time owner).
 *   3. If 1 store  → auto-activates and redirects to /cashier.
 *   4. If 2+ stores → shows a picker so the user can choose a branch.
 *
 * Requires authentication (wrapped in ProtectedRoute in router.tsx).
 * No AppShell / NavBar — this is part of the auth/onboarding flow.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { findOrCreateMain, activateStore } from './setup.service'
import type { StoreRecord } from './setup.service'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'

export default function StorePickerPage() {
  const navigate = useNavigate()
  const { user, setSpreadsheetId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    void resolveStores()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function resolveStores() {
    try {
      const { stores: list } = await findOrCreateMain(user?.email ?? '')
      if (list.length === 0) {
        navigate('/setup', { replace: true })
        return
      }
      if (list.length === 1) {
        await activate(list[0])
        return
      }
      setStores(list)
    } catch (err) {
      setError(`Gagal memuat daftar toko: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  async function activate(store: StoreRecord) {
    setActivating(true)
    try {
      await activateStore(store)
      setSpreadsheetId(store.master_spreadsheet_id)
      navigate('/cashier', { replace: true })
    } catch (err) {
      setError(`Gagal mengaktifkan toko: ${String(err)}`)
      setActivating(false)
    }
  }

  if (loading || activating) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="store-picker-loading">
        <p className="text-muted-foreground">Memuat toko…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <Alert variant="destructive" data-testid="store-picker-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => void resolveStores()} data-testid="btn-retry">
          Coba Lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Pilih Toko</h1>
      <p className="text-muted-foreground">Pilih toko yang ingin Anda buka.</p>

      <div className="flex flex-col gap-3 w-full max-w-sm" data-testid="store-list">
        {stores.map((store) => (
          <button
            key={store.store_id}
            className="rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent transition-colors"
            onClick={() => void activate(store)}
            data-testid={`btn-store-${store.store_id}`}
          >
            <p className="font-medium">{store.store_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{store.my_role}</p>
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => navigate('/setup')}
        data-testid="btn-add-store"
      >
        + Tambah Toko Baru
      </Button>
    </div>
  )
}
