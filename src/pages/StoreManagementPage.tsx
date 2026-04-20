/**
 * StoreManagementPage — lets an owner add, edit, and remove stores.
 *
 * Ownership is determined by comparing store.owner_email against the
 * signed-in user's email. Owned stores show Edit + Hapus (soft-delete).
 * Non-owned stores show Keluar (leave — removes caller's Members row only).
 *
 * Post-action redirects:
 *   - removeOwnedStore of active store → first remaining store, or /setup if empty
 *   - removeAccessToStore               → /stores (store picker)
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { activateStore } from '../modules/auth/setup.service'
import {
  listStores,
  createStore,
  updateStore,
  removeOwnedStore,
  removeAccessToStore,
  StoreManagementError,
} from '../modules/settings/store-management.service'
import type { StoreRecord } from '../modules/auth/setup.service'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Alert, AlertDescription } from '../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { useSyncStore } from '../store/syncStore'

export default function StoreManagementPage() {
  const navigate = useNavigate()
  const { user, activeStoreId, stores: authStores } = useAuthStore()
  const lastHydratedAt = useSyncStore((s) => s.lastHydratedAt)

  const [stores, setStores] = useState<StoreRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  // ── Add store dialog ────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // ── Edit store dialog ───────────────────────────────────────────────────────
  const [editStore, setEditStore] = useState<StoreRecord | null>(null)
  const [editName, setEditName] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // ── Delete confirmation dialog ──────────────────────────────────────────────
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Leave confirmation dialog ───────────────────────────────────────────────
  const [leaveStore, setLeaveStore] = useState<StoreRecord | null>(null)
  const [leaveLoading, setLeaveLoading] = useState(false)

  // ── Activate store ──────────────────────────────────────────────────────────
  const [activateLoading, setActivateLoading] = useState<string | null>(null)

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadStores() {
    try {
      const result = await listStores()
      setStores(result)
      // Sync authStore so NavBar store picker reflects the current stores from
      // Sheets — this is necessary after refresh when localStorage is stale
      // (e.g. a store was added before the active session was persisted).
      useAuthStore.getState().setStores(result, activeStoreId)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void loadStores()
  }, [])

  useEffect(() => {
    if (lastHydratedAt === null) return
    initialized.current = false
    void loadStores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastHydratedAt])

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAddLoading(true)
    try {
      await createStore(newName)
      setNewName('')
      setShowAdd(false)
      const updated = await listStores()
      setStores(updated)
      // Sync authStore so NavBar store picker re-evaluates stores.length >= 2.
      useAuthStore.getState().setStores(updated, activeStoreId)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editStore) return
    setError(null)
    setEditLoading(true)
    try {
      await updateStore(editStore.store_id, { store_name: editName })
      setEditStore(null)
      const updated = await listStores()
      setStores(updated)
      // Sync authStore so NavBar option labels reflect the renamed store.
      useAuthStore.getState().setStores(updated, activeStoreId)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteStoreId) return
    setError(null)
    setDeleteLoading(true)
    try {
      await removeOwnedStore(deleteStoreId)
      setDeleteStoreId(null)
      const remaining = await listStores()
      setStores(remaining)
      // If we just deleted the active store, switch to the first remaining one.
      if (deleteStoreId === activeStoreId) {
        if (remaining.length > 0) {
          await activateStore(remaining[0])
          useAuthStore.getState().setStores(remaining, remaining[0].store_id)
        } else {
          useAuthStore.getState().clearAuth()
          navigate('/setup')
        }
      }
    } catch (err) {
      setDeleteStoreId(null)
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleLeave() {
    if (!leaveStore) return
    setError(null)
    setLeaveLoading(true)
    try {
      await removeAccessToStore(leaveStore.master_spreadsheet_id)
      setLeaveStore(null)
      // User no longer has access to any store — send to store picker.
      navigate('/stores')
    } catch (err) {
      setLeaveStore(null)
      setError(String(err instanceof StoreManagementError ? err.message : err))
    } finally {
      setLeaveLoading(false)
    }
  }

  async function handleActivate(store: StoreRecord) {
    setError(null)
    setActivateLoading(store.store_id)
    try {
      await activateStore(store)
      useAuthStore.getState().setStores(authStores, store.store_id)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setActivateLoading(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Kelola Toko</h2>
        <Button
          data-testid="btn-add-store"
          onClick={() => { setNewName(''); setShowAdd(true) }}
        >
          + Tambah Toko
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" data-testid="alert-store-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Toko</TableHead>
            <TableHead>Pemilik</TableHead>
            <TableHead>Peran Saya</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((store) => {
            const isOwner = store.owner_email === user?.email
            return (
              <TableRow key={store.store_id} data-testid={`store-row-${store.store_id}`}>
                <TableCell>{store.store_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{store.owner_email}</TableCell>
                <TableCell className="text-sm capitalize">{store.my_role}</TableCell>
                <TableCell className="text-right space-x-2">
                  {store.store_id !== activeStoreId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`btn-activate-store-${store.store_id}`}
                      disabled={activateLoading === store.store_id}
                      onClick={() => void handleActivate(store)}
                    >
                      {activateLoading === store.store_id ? 'Memproses…' : 'Aktifkan'}
                    </Button>
                  )}
                  {isOwner && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`btn-edit-store-${store.store_id}`}
                        onClick={() => {
                          setEditStore(store)
                          setEditName(store.store_name)
                          setError(null)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        data-testid={`btn-delete-store-${store.store_id}`}
                        onClick={() => { setDeleteStoreId(store.store_id); setError(null) }}
                      >
                        Hapus
                      </Button>
                    </>
                  )}
                  {!isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`btn-leave-store-${store.store_id}`}
                      onClick={() => { setLeaveStore(store); setError(null) }}
                    >
                      Keluar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {stores.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Belum ada toko
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ── Add store dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Toko Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-store-name">Nama Toko</Label>
              <Input
                id="new-store-name"
                data-testid="input-store-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="cth. Cabang Sudirman"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                data-testid="btn-save-store"
                disabled={addLoading || !newName.trim()}
              >
                {addLoading ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit store dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editStore} onOpenChange={(open) => { if (!open) setEditStore(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Toko</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-store-name">Nama Toko</Label>
              <Input
                id="edit-store-name"
                data-testid="input-store-name-edit"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditStore(null)}>
                Batal
              </Button>
              <Button
                type="submit"
                data-testid="btn-save-store-edit"
                disabled={editLoading || !editName.trim()}
              >
                {editLoading ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog
        open={!!deleteStoreId}
        onOpenChange={(open) => { if (!open) setDeleteStoreId(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Toko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Toko akan dihapus dari daftar Anda. Data transaksi tidak akan hilang.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStoreId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              data-testid="btn-confirm-delete-store"
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Leave confirmation dialog ────────────────────────────────────── */}
      <Dialog
        open={!!leaveStore}
        onOpenChange={(open) => { if (!open) setLeaveStore(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keluar dari Toko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Anda akan keluar dari <strong>{leaveStore?.store_name}</strong>. Akses Anda ke
            toko ini akan dicabut.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveStore(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              data-testid="btn-confirm-leave-store"
              disabled={leaveLoading}
              onClick={handleLeave}
            >
              {leaveLoading ? 'Memproses…' : 'Keluar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
