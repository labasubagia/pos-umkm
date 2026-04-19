/**
 * CatalogPage — Product catalog management (categories, products, CSV import).
 * Accessible to owner and manager roles.
 */
import { useEffect } from 'react'
import { CategoryList } from '../modules/catalog/CategoryList'
import { ProductList } from '../modules/catalog/ProductList'
import { CSVImport } from '../modules/catalog/CSVImport'
import { useCatalogStore } from '../modules/catalog/useCatalog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function CatalogPage() {
  const { loadCatalog, loading } = useCatalogStore()

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {loading ? (
        <p className="text-sm text-gray-500">Memuat katalog…</p>
      ) : (
        <Tabs defaultValue="products" className="gap-0">
          <div className="overflow-x-auto mb-4">
            <TabsList variant="line" className="min-w-full">
              <TabsTrigger value="products" data-testid="btn-tab-products">Produk</TabsTrigger>
              <TabsTrigger value="categories" data-testid="btn-tab-categories">Kategori</TabsTrigger>
              <TabsTrigger value="import" data-testid="btn-tab-import">Import CSV</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="products"><ProductList /></TabsContent>
          <TabsContent value="categories"><CategoryList /></TabsContent>
          <TabsContent value="import"><CSVImport /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}

