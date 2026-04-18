/**
 * ProductList.tsx — Displays the product catalog with add, edit, delete,
 * and variant management actions.
 */

import { useState } from 'react'
import { useCatalogStore } from './useCatalog'
import { addProduct, updateProduct, deleteProduct } from './catalog.service'
import type { NewProduct, ProductChanges } from './catalog.service'
import { ProductForm } from './ProductForm'
import { VariantManager } from './VariantManager'
import { formatIDR } from '../../lib/formatters'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'

export function ProductList() {
  const { categories, products, addProductToStore, updateProductInStore, removeProductFromStore } =
    useCatalogStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [variantProductId, setVariantProductId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(product: NewProduct) {
    const created = await addProduct(product)
    addProductToStore(created)
    setShowAddForm(false)
  }

  async function handleUpdate(id: string, changes: ProductChanges) {
    await updateProduct(id, changes)
    updateProductInStore(id, changes)
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteProduct(id)
      removeProductFromStore(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  if (variantProductId) {
    const product = products.find((p) => p.id === variantProductId)
    return (
      <div>
        <Button
          variant="ghost"
          onClick={() => setVariantProductId(null)}
          className="mb-4"
        >
          ← Kembali ke Daftar Produk
        </Button>
        {product && <VariantManager product={product} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Produk</h2>
        <Button onClick={() => setShowAddForm(true)} data-testid="btn-add-product">
          + Tambah Produk
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <div className="rounded border border-gray-200 p-4">
          <ProductForm
            categories={categories}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Tambah"
          />
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada produk. Tambahkan produk pertama Anda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((product) => {
            const editingThisProduct = editingId === product.id
            return (
              <li key={product.id} className="rounded border border-gray-200 p-3" data-testid={`product-item-${product.id}`}>
                {editingThisProduct ? (
                  <ProductForm
                    categories={categories}
                    initialProduct={product}
                    onSubmit={(changes) => handleUpdate(product.id, changes)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Perbarui"
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium" data-testid={`product-name-${product.id}`}>{product.name}</span>
                      <span className="text-xs text-gray-500">
                        {categoryMap.get(product.category_id) ?? '—'} ·{' '}
                        {product.sku ? `SKU: ${product.sku} · ` : ''}
                        <span data-testid={`product-price-${product.id}`}>{formatIDR(product.price)}</span>{' '}
                        · <span data-testid={`product-stock-${product.id}`}>Stok: {product.stock}</span>
                        {product.has_variants && ' · Memiliki varian'}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {product.has_variants && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVariantProductId(product.id)}
                          className="text-purple-600"
                        >
                          Varian
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(product.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
