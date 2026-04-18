/**
 * CategoryList.tsx — Displays the list of product categories with
 * inline edit and delete actions.
 *
 * Reads from useCatalogStore; writes go through catalog.service functions
 * and then update the store optimistically.
 */

import { useState } from 'react'
import { useCatalogStore } from './useCatalog'
import { addCategory, updateCategory, deleteCategory } from './catalog.service'
import { CategoryForm } from './CategoryForm'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'

export function CategoryList() {
  const { categories, addCategoryToStore, updateCategoryInStore, removeCategoryFromStore } =
    useCatalogStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleAdd(name: string) {
    const category = await addCategory(name)
    addCategoryToStore(category)
    setShowAddForm(false)
  }

  async function handleUpdate(id: string, name: string) {
    await updateCategory(id, name)
    updateCategoryInStore(id, name)
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteCategory(id)
      removeCategoryFromStore(id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kategori Produk</h2>
        <Button onClick={() => setShowAddForm(true)} data-testid="btn-add-category">
          + Tambah Kategori
        </Button>
      </div>

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <div className="rounded border border-gray-200 p-4">
          <CategoryForm
            onSubmit={handleAdd}
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
                  onSubmit={(name) => handleUpdate(cat.id, name)}
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
                      onClick={() => handleDelete(cat.id)}
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
