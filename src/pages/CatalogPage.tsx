/**
 * CatalogPage — Product catalog management (categories, products, CSV import).
 * Accessible to owner and manager roles.
 */
import { useEffect, useState } from 'react'
import { CategoryList } from '../modules/catalog/CategoryList'
import { ProductList } from '../modules/catalog/ProductList'
import { CSVImport } from '../modules/catalog/CSVImport'
import { useCatalogStore } from '../modules/catalog/useCatalog'

type Tab = 'categories' | 'products' | 'import'

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const { loadCatalog, loading } = useCatalogStore()

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'products', label: 'Produk' },
    { key: 'categories', label: 'Kategori' },
    { key: 'import', label: 'Import CSV' },
  ]

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">Katalog Produk</h1>

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            data-testid={`btn-tab-${t.key}`}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Memuat katalog…</p>
      ) : (
        <>
          {activeTab === 'products' && <ProductList />}
          {activeTab === 'categories' && <CategoryList />}
          {activeTab === 'import' && <CSVImport />}
        </>
      )}
    </div>
  )
}

