/**
 * CategoryForm.tsx — Form for creating and editing a category.
 * Used in both "add" (no initialName) and "edit" (initialName provided) modes.
 */

import { useState } from 'react'

interface Props {
  initialName?: string
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function CategoryForm({ initialName = '', onSubmit, onCancel, submitLabel = 'Simpan' }: Props) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Nama kategori tidak boleh kosong')
      return
    }
    if (name.trim().length > 100) {
      setError('Nama kategori maksimal 100 karakter')
      return
    }
    setLoading(true)
    try {
      await onSubmit(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="category-name" className="text-sm font-medium">
          Nama Kategori
        </label>
        <input
          id="category-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Contoh: Makanan, Minuman, Snack"
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Menyimpan…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
