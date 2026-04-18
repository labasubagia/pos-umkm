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
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          data-testid="btn-add-category"
        >
          + Tambah Kategori
        </button>
      </div>

      {deleteError && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
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
                    <button
                      onClick={() => setEditingId(cat.id)}
                      className="text-sm text-blue-600 hover:underline"
                      data-testid={`btn-edit-category-${cat.id}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="text-sm text-red-600 hover:underline"
                      data-testid={`btn-delete-category-${cat.id}`}
                    >
                      Hapus
                    </button>
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
