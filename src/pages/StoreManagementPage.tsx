/**
 * StoreManagementPage — lets an owner add, edit, and remove stores.
 *
 * All data reads come from useStores() (React Query → service → Dexie/Sheets).
 * All mutations call useMutation + invalidateQueries(['stores']) so every
 * subscriber (NavBar, this page) auto-refetches without manual sync.
 *
 * Post-action redirects:
 *   - removeOwnedStore of active store → first remaining store, or /setup if empty
 *   - removeAccessToStore               → /stores (store picker)
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { STORES_QUERY_KEY, useStores } from "../hooks/useStores";
import { syncManager } from "../lib/adapters";
import type { StoreRecord } from "../modules/auth/setup.service";
import { activateStore } from "../modules/auth/setup.service";
import {
  createStore,
  removeAccessToStore,
  removeOwnedStore,
  StoreManagementError,
  updateStore,
} from "../modules/settings/store-management.service";
import { useAuthStore } from "../store/authStore";

export default function StoreManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeStoreId, setStoreSession } = useAuthStore();

  const { data: stores = [], error: storesError } = useStores();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = mutationError ?? (storesError ? String(storesError) : null);

  // ── Add store dialog ──────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  // ── Edit store dialog ─────────────────────────────────────────────────────
  const [editStore, setEditStore] = useState<StoreRecord | null>(null);
  const [editName, setEditName] = useState("");

  // ── Delete confirmation dialog ────────────────────────────────────────────
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);

  // ── Leave confirmation dialog ─────────────────────────────────────────────
  const [leaveStore, setLeaveStore] = useState<StoreRecord | null>(null);

  const invalidateStores = () =>
    queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (name: string) => createStore(name),
    onSuccess: () => {
      setNewName("");
      setShowAdd(false);
      void invalidateStores();
    },
    onError: (err) =>
      setMutationError(String(err instanceof Error ? err.message : err)),
  });

  const editMutation = useMutation({
    mutationFn: ({ storeId, name }: { storeId: string; name: string }) =>
      updateStore(storeId, { store_name: name }),
    onSuccess: () => {
      setEditStore(null);
      void invalidateStores();
    },
    onError: (err) =>
      setMutationError(String(err instanceof Error ? err.message : err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      await removeOwnedStore(storeId);
      await invalidateStores();
      if (storeId === activeStoreId) {
        const remaining =
          queryClient.getQueryData<StoreRecord[]>(STORES_QUERY_KEY) ?? [];
        if (remaining.length > 0) {
          const session = await activateStore(remaining[0]);
          setStoreSession(
            session.spreadsheetId,
            session.monthlySpreadsheetId,
            remaining[0].store_id,
          );
        } else {
          syncManager.triggerSync();
          useAuthStore.getState().clearAuth();
          navigate("/setup");
        }
      }
    },
    onSuccess: () => setDeleteStoreId(null),
    onError: (err) => {
      setDeleteStoreId(null);
      setMutationError(String(err instanceof Error ? err.message : err));
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (masterId: string) => removeAccessToStore(masterId),
    onSuccess: () => {
      setLeaveStore(null);
      navigate("/stores");
    },
    onError: (err) => {
      setLeaveStore(null);
      setMutationError(
        String(err instanceof StoreManagementError ? err.message : err),
      );
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (store: StoreRecord) => {
      const session = await activateStore(store);
      setStoreSession(
        session.spreadsheetId,
        session.monthlySpreadsheetId,
        store.store_id,
      );
    },
    onError: (err) =>
      setMutationError(String(err instanceof Error ? err.message : err)),
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Kelola Toko</h2>
        <Button
          data-testid="btn-add-store"
          onClick={() => {
            setNewName("");
            setShowAdd(true);
          }}
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
            const isOwner = store.owner_email === user?.email;
            return (
              <TableRow
                key={store.store_id}
                data-testid={`store-row-${store.store_id}`}
              >
                <TableCell>{store.store_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {store.owner_email}
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {store.my_role}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {store.store_id !== activeStoreId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`btn-activate-store-${store.store_id}`}
                      disabled={
                        activateMutation.isPending &&
                        activateMutation.variables?.store_id === store.store_id
                      }
                      onClick={() => {
                        setMutationError(null);
                        activateMutation.mutate(store);
                      }}
                    >
                      {activateMutation.isPending &&
                      activateMutation.variables?.store_id === store.store_id
                        ? "Memproses…"
                        : "Aktifkan"}
                    </Button>
                  )}
                  {isOwner && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`btn-edit-store-${store.store_id}`}
                        onClick={() => {
                          setEditStore(store);
                          setEditName(store.store_name);
                          setMutationError(null);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        data-testid={`btn-delete-store-${store.store_id}`}
                        title={"Hapus toko"}
                        onClick={() => {
                          setDeleteStoreId(store.store_id);
                          setMutationError(null);
                        }}
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
                      onClick={() => {
                        setLeaveStore(store);
                        setMutationError(null);
                      }}
                    >
                      Keluar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {stores.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground py-8"
              >
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMutationError(null);
              addMutation.mutate(newName);
            }}
            className="flex flex-col gap-4"
          >
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdd(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                data-testid="btn-save-store"
                disabled={addMutation.isPending || !newName.trim()}
              >
                {addMutation.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit store dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!editStore}
        onOpenChange={(open) => {
          if (!open) setEditStore(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Toko</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editStore) return;
              setMutationError(null);
              editMutation.mutate({
                storeId: editStore.store_id,
                name: editName,
              });
            }}
            className="flex flex-col gap-4"
          >
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditStore(null)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                data-testid="btn-save-store-edit"
                disabled={editMutation.isPending || !editName.trim()}
              >
                {editMutation.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog
        open={!!deleteStoreId}
        onOpenChange={(open) => {
          if (!open) setDeleteStoreId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Toko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Toko akan dihapus dari daftar Anda. Data transaksi tidak akan
            hilang.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStoreId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              data-testid="btn-confirm-delete-store"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteStoreId && deleteMutation.mutate(deleteStoreId)
              }
            >
              {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Leave confirmation dialog ────────────────────────────────────── */}
      <Dialog
        open={!!leaveStore}
        onOpenChange={(open) => {
          if (!open) setLeaveStore(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keluar dari Toko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Anda akan keluar dari <strong>{leaveStore?.store_name}</strong>.
            Akses Anda ke toko ini akan dicabut.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveStore(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              data-testid="btn-confirm-leave-store"
              disabled={leaveMutation.isPending}
              onClick={() =>
                leaveStore &&
                leaveMutation.mutate(leaveStore.master_spreadsheet_id)
              }
            >
              {leaveMutation.isPending ? "Memproses…" : "Keluar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
