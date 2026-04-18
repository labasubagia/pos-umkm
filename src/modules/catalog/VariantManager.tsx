/**
 * VariantManager.tsx — Manages variants for a product that has has_variants=true.
 * Shows existing variants and allows adding/deleting them.
 */

import { useState } from 'react'
import { useCatalogStore } from './useCatalog'
import { addVariant, deleteVariant } from './catalog.service'
import type { Product } from './catalog.service'
import { formatIDR } from '../../lib/formatters'

interface Props {
  product: Product
}

export function VariantManager({ product }: Props) {
  const { variants, addVariantToStore, removeVariantFromStore } = useCatalogStore()

  const productVariants = variants.filter((v) => v.product_id === product.id)

  const [optionName, setOptionName] = useState('')
  const [optionValue, setOptionValue] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const priceNum = parseInt(price, 10)
    if (!Number.isInteger(priceNum) || priceNum <= 0) {
      setError('Harga harus bilangan bulat positif')
      return
    }
    if (!optionValue.trim()) {
      setError('Nilai varian tidak boleh kosong')
      return
    }
    setLoading(true)
    try {
      const variant = await addVariant(
        product.id,
        optionName.trim(),
        optionValue.trim(),
        priceNum,
        parseInt(stock, 10) || 0,
      )
      addVariantToStore(variant)
      setOptionName('')
      setOptionValue('')
      setPrice('')
      setStock('0')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(variantId: string) {
    await deleteVariant(variantId)
    removeVariantFromStore(variantId)
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Varian — {product.name}</h2>

      <form onSubmit={handleAdd} className="rounded border border-gray-200 p-4 flex flex-col gap-3">
        <h3 className="text-sm font-medium">Tambah Varian</h3>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium">Tipe (misal: Ukuran)</label>
            <input
              type="text"
              value={optionName}
              onChange={(e) => setOptionName(e.target.value)}
              placeholder="Ukuran"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium">Nilai (misal: S, M, L)</label>
            <input
              type="text"
              value={optionValue}
              onChange={(e) => setOptionValue(e.target.value)}
              placeholder="M"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium">Harga (Rp)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={1}
              step={1}
              placeholder="25000"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium">Stok</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min={0}
              step={1}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Menambahkan…' : 'Tambah Varian'}
          </button>
        </div>
      </form>

      {productVariants.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada varian untuk produk ini.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {productVariants.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {v.option_name}: {v.option_value}
                </span>
                <span className="text-xs text-gray-500">
                  {formatIDR(v.price)} · Stok: {v.stock}
                </span>
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
