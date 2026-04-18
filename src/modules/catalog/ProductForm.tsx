/**
 * ProductForm.tsx — Form for creating and editing a product.
 * Accepts categories list to populate the category selector.
 */

import { useState } from 'react'
import type { Category, NewProduct } from './catalog.service'

interface Props {
  categories: Category[]
  initialProduct?: Partial<NewProduct>
  onSubmit: (product: NewProduct) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function ProductForm({
  categories,
  initialProduct = {},
  onSubmit,
  onCancel,
  submitLabel = 'Simpan',
}: Props) {
  const [name, setName] = useState(initialProduct.name ?? '')
  const [sku, setSku] = useState(initialProduct.sku ?? '')
  const [price, setPrice] = useState(String(initialProduct.price ?? ''))
  const [stock, setStock] = useState(String(initialProduct.stock ?? '0'))
  const [categoryId, setCategoryId] = useState(initialProduct.category_id ?? '')
  const [hasVariants, setHasVariants] = useState(initialProduct.has_variants ?? false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Nama produk tidak boleh kosong')
      return
    }
    const priceNum = parseInt(price, 10)
    if (!Number.isInteger(priceNum) || priceNum <= 0 || String(priceNum) !== price.trim()) {
      setError('Harga harus bilangan bulat positif')
      return
    }
    if (!categoryId) {
      setError('Pilih kategori terlebih dahulu')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        sku: sku.trim(),
        price: priceNum,
        stock: parseInt(stock, 10) || 0,
        category_id: categoryId,
        has_variants: hasVariants,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="product-name" className="text-sm font-medium">
          Nama Produk
        </label>
        <input
          id="product-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Nasi Goreng Spesial"
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="product-category" className="text-sm font-medium">
          Kategori
        </label>
        <select
          id="product-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Pilih Kategori --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="product-price" className="text-sm font-medium">
            Harga (Rp)
          </label>
          <input
            id="product-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={1}
            step={1}
            placeholder="15000"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="product-stock" className="text-sm font-medium">
            Stok
          </label>
          <input
            id="product-stock"
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            min={0}
            step={1}
            placeholder="0"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="product-sku" className="text-sm font-medium">
          SKU (opsional)
        </label>
        <input
          id="product-sku"
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="NASGOR-01"
          maxLength={50}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasVariants}
          onChange={(e) => setHasVariants(e.target.checked)}
        />
        Produk ini memiliki varian (ukuran, warna, dll)
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

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
