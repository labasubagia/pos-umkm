/**
 * VariantManager.tsx — Manages variants for a product that has has_variants=true.
 * Shows existing variants and allows adding/deleting them.
 *
 * Data comes from useVariants() (React Query). Mutations invalidate the query.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useVariants, VARIANTS_QUERY_KEY } from '../../hooks/useVariants'
import { addVariant, deleteVariant } from './catalog.service'
import type { Product } from './catalog.service'
import { formatIDR } from '../../lib/formatters'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'

interface Props {
  product: Product
}

export function VariantManager({ product }: Props) {
  const queryClient = useQueryClient()
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  const { data: variants = [] } = useVariants()

  const productVariants = variants.filter((v) => v.product_id === product.id)

  const [optionName, setOptionName] = useState('')
  const [optionValue, setOptionValue] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: VARIANTS_QUERY_KEY(activeStoreId) })

  const addMutation = useMutation({
    mutationFn: () => {
      const priceNum = parseInt(price, 10)
      if (!Number.isInteger(priceNum) || priceNum <= 0) throw new Error('Harga harus bilangan bulat positif')
      if (!optionValue.trim()) throw new Error('Nilai varian tidak boleh kosong')
      return addVariant(product.id, optionName.trim(), optionValue.trim(), priceNum, parseInt(stock, 10) || 0)
    },
    onSuccess: () => {
      setOptionName('')
      setOptionValue('')
      setPrice('')
      setStock('0')
      setError(null)
      void invalidate()
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => deleteVariant(variantId),
    onSuccess: () => void invalidate(),
    onError: (err: Error) => setError(err.message),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    addMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Varian — {product.name}</h2>

      <form onSubmit={handleAdd} className="rounded border border-gray-200 p-4 flex flex-col gap-3">
        <h3 className="text-sm font-medium">Tambah Varian</h3>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Tipe (misal: Ukuran)</Label>
            <Input
              type="text"
              value={optionName}
              onChange={(e) => setOptionName(e.target.value)}
              placeholder="Ukuran"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Nilai (misal: S, M, L)</Label>
            <Input
              type="text"
              value={optionValue}
              onChange={(e) => setOptionValue(e.target.value)}
              placeholder="M"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Harga (Rp)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={1}
              step={1}
              placeholder="25000"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Stok</Label>
            <Input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min={0}
              step={1}
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Menambahkan…' : 'Tambah Varian'}
          </Button>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(v.id)}
                className="text-red-600 hover:text-red-700"
              >
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
