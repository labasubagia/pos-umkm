// Catalog module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/catalog', never from internal paths.

export type { Category, Product, Variant, NewProduct, ProductChanges } from './catalog.service'
export {
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  fetchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  decrementStock,
  fetchVariants,
  addVariant,
  deleteVariant,
  decrementVariantStock,
  CatalogError,
} from './catalog.service'
export { useCatalogStore } from './useCatalog'
export type { ParsedProduct, RowValidationResult } from './csv.service'
export { parseProductCSV, validateImportRows, bulkImportProducts } from './csv.service'
export { CategoryList } from './CategoryList'
export { CategoryForm } from './CategoryForm'
export { ProductList } from './ProductList'
export { ProductForm } from './ProductForm'
export { VariantManager } from './VariantManager'
export { CSVImport } from './CSVImport'

