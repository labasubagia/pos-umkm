/**
 * useCatalog.ts — Zustand store slice for the Product Catalog.
 *
 * All catalog entities (categories, products, variants) are loaded once on
 * app start and cached here. Components read from this store; catalog.service
 * functions write through the adapter and then trigger a store refresh.
 *
 * Keeping catalog data in a global store avoids repeated Sheets API calls
 * when navigating between the catalog management page and the cashier screen.
 */

import { create } from 'zustand'
import type { Category, Product, Variant } from './catalog.service'
import {
  fetchCategories,
  fetchProducts,
  fetchVariants,
} from './catalog.service'

interface CatalogState {
  categories: Category[]
  products: Product[]
  variants: Variant[]
  loading: boolean
  error: string | null

  /** Load all catalog data from the adapter into the store. */
  loadCatalog: () => Promise<void>

  /** Optimistically add a category to the local store. */
  addCategoryToStore: (category: Category) => void

  /** Optimistically update a category name in the local store. */
  updateCategoryInStore: (id: string, name: string) => void

  /** Remove a category from the local store (after soft-delete). */
  removeCategoryFromStore: (id: string) => void

  /** Optimistically add a product to the local store. */
  addProductToStore: (product: Product) => void

  /** Optimistically update product fields in the local store. */
  updateProductInStore: (id: string, changes: Partial<Product>) => void

  /** Remove a product from the local store (after soft-delete). */
  removeProductFromStore: (id: string) => void

  /** Optimistically add a variant to the local store. */
  addVariantToStore: (variant: Variant) => void

  /** Remove a variant from the local store (after soft-delete). */
  removeVariantFromStore: (id: string) => void
}

export const useCatalogStore = create<CatalogState>((set) => ({
  categories: [],
  products: [],
  variants: [],
  loading: false,
  error: null,

  loadCatalog: async () => {
    set({ loading: true, error: null })
    try {
      const [categories, products, variants] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchVariants(),
      ])
      set({ categories, products, variants, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  addCategoryToStore: (category) =>
    set((state) => ({ categories: [...state.categories, category] })),

  updateCategoryInStore: (id, name) =>
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    })),

  removeCategoryFromStore: (id) =>
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),

  addProductToStore: (product) =>
    set((state) => ({ products: [...state.products, product] })),

  updateProductInStore: (id, changes) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    })),

  removeProductFromStore: (id) =>
    set((state) => ({ products: state.products.filter((p) => p.id !== id) })),

  addVariantToStore: (variant) =>
    set((state) => ({ variants: [...state.variants, variant] })),

  removeVariantFromStore: (id) =>
    set((state) => ({ variants: state.variants.filter((v) => v.id !== id) })),
}))
