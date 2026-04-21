/**
 * CategoryList.tsx — Displays the list of product categories with
 * inline edit and delete actions.
 *
 * Data comes from useCategories() (React Query). Mutations call the
 * service directly and invalidate the query to trigger a refetch.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useCategories, CATEGORIES_QUERY_KEY } from '../../hooks/useCategories'
import { addCategory, updateCategory, deleteCategory } from './catalog.service'
import { CategoryForm } from './CategoryForm'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'

export function CategoryList() {
  const queryClient = useQueryClient()
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  const { data: categories = [], isLoading, error: fetchError } = useCategories()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY(activeStoreId) })

  const addMutation = useMutation({
    mutationFn: (name: string) => addCategory(name),
    onSuccess: () => { setShowAddForm(false); void invalidate() },
    onError: (err: Error) => setMutationError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, name),
    onSuccess: () => { setEditingId(null); void invalidate() },
    onError: (err: Error) => setMutationError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => { setMutationError(null); void invalidate() },
    onError: (err: Error) => setMutationError(err.message),
  })

  const displayError = mutationError ?? (fetchError instanceof Error ? fetchError.message : null)

  if (isLoading) return <p className="text-sm text-gray-500">Memuat kategori…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kategori Produk</h2>
        <Button onClick={() => setShowAddForm(true)} data-testid="btn-add-category">
          + Tambah Kategori
        </Button>
      </div>

      {displayError && (
        <Alert variant="destructive">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <div className="rounded border border-gray-200 p-4">
          <CategoryForm
            onSubmit={(name) => addMutation.mutate(name)}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Tambah"
          />
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada kategori. Tambahkan kategori pertama Anda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((cat) => (
            <li key={cat.id} className="rounded border border-gray-200 p-3" data-testid={`category-item-${cat.id}`}>
              {editingId === cat.id ? (
                <CategoryForm
                  initialName={cat.name}
                  onSubmit={(name) => updateMutation.mutate({ id: cat.id, name })}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Perbarui"
                />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-medium" data-testid={`category-name-${cat.id}`}>{cat.name}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(cat.id)}
                      data-testid={`btn-edit-category-${cat.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(cat.id)}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`btn-delete-category-${cat.id}`}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
