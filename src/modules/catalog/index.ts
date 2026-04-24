// Catalog module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/catalog', never from internal paths.

export { CategoryForm } from "./CategoryForm";
export { CategoryList } from "./CategoryList";
export { CSVImport } from "./CSVImport";
export type {
  Category,
  NewProduct,
  Product,
  ProductChanges,
  Variant,
} from "./catalog.service";
export {
  addCategory,
  addProduct,
  addVariant,
  CatalogError,
  decrementStock,
  decrementVariantStock,
  deleteCategory,
  deleteProduct,
  deleteVariant,
  fetchCategories,
  fetchProducts,
  fetchVariants,
  updateCategory,
  updateProduct,
} from "./catalog.service";
export type { ParsedProduct, RowValidationResult } from "./csv.service";
export {
  bulkImportProducts,
  parseProductCSV,
  validateImportRows,
} from "./csv.service";
export { ProductForm } from "./ProductForm";
export { ProductList } from "./ProductList";
export { VariantManager } from "./VariantManager";
