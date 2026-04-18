/**
 * ProductSearch.tsx — Product search grid for the cashier screen (T026).
 *
 * Renders a text input and shows product cards in a grid. Clicking a card
 * adds it to the cart (if no variants) or opens the variant selector.
 */
import { useState } from 'react'
import { Search } from 'lucide-react'
import { searchProducts } from './cashier.service'
import { useCartStore } from './useCart'
import type { Product, Variant } from '../catalog/catalog.service'

interface Props {
  products: Product[]
  variants: Variant[]
}

export function ProductSearch({ products, variants }: Props) {
  const [query, setQuery] = useState('')
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const addItem = useCartStore((s) => s.addItem)

  const results = searchProducts(query, products)

  function handleProductClick(product: Product) {
    if (product.has_variants) {
      setVariantProduct(product)
    } else {
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
      })
    }
  }

  function handleVariantClick(variant: Variant, product: Product) {
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: `${product.name} – ${variant.name}`,
      price: variant.price,
    })
    setVariantProduct(null)
  }

  const productVariants = variantProduct
    ? variants.filter((v) => v.product_id === variantProduct.id)
    : []

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Cari produk atau SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Cari produk"
        />
      </div>

      {/* Variant selector modal (inline) */}
      {variantProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-semibold mb-3">Pilih Varian — {variantProduct.name}</h3>
            <div className="flex flex-col gap-2">
              {productVariants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleVariantClick(v, variantProduct)}
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-blue-50 text-sm"
                >
                  <span>{v.name}</span>
                  <span className="font-semibold text-blue-700">
                    Rp {v.price.toLocaleString('id-ID')}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setVariantProduct(null)}
              className="mt-4 w-full text-sm text-gray-500 hover:underline"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Product grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto"
        role="list"
        aria-label="Daftar produk"
      >
        {results.length === 0 && (
          <p className="col-span-full text-center text-sm text-gray-400 py-8">
            Produk tidak ditemukan
          </p>
        )}
        {results.map((product) => (
          <button
            key={product.id}
            role="listitem"
            onClick={() => handleProductClick(product)}
            disabled={!product.has_variants && product.stock <= 0}
            className="flex flex-col items-start p-3 border rounded-lg text-left text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="font-medium leading-tight">{product.name}</span>
            {product.sku && (
              <span className="text-xs text-gray-400 mt-0.5">{product.sku}</span>
            )}
            <span className="mt-1 font-semibold text-blue-700">
              Rp {product.price.toLocaleString('id-ID')}
            </span>
            {!product.has_variants && (
              <span className={`text-xs mt-0.5 ${product.stock <= 5 ? 'text-orange-500' : 'text-gray-400'}`}>
                Stok: {product.stock}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
