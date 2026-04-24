/**
 * CatalogPage — Product catalog management (categories, products, CSV import).
 * Accessible to owner and manager roles.
 *
 * Data loading is handled by useProducts() / useCategories() (React Query)
 * inside child components — no explicit loadCatalog() call needed here.
 */

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useProducts } from "../hooks/useProducts";
import { CategoryList } from "../modules/catalog/CategoryList";
import { CSVImport } from "../modules/catalog/CSVImport";
import { ProductList } from "../modules/catalog/ProductList";

export default function CatalogPage() {
  const { isLoading } = useProducts();

  return (
    <>
      {isLoading ? (
        <p className="text-sm text-gray-500">Memuat katalog…</p>
      ) : (
        <Tabs defaultValue="products" className="gap-0">
          <TabsList variant="line" className="w-full mb-4">
            <TabsTrigger value="products" data-testid="btn-tab-products">
              Produk
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="btn-tab-categories">
              Kategori
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="btn-tab-import">
              Import CSV
            </TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductList />
          </TabsContent>
          <TabsContent value="categories">
            <CategoryList />
          </TabsContent>
          <TabsContent value="import">
            <CSVImport />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
