/**
 * ProductSearch.tsx — Product search grid for the cashier screen (T026).
 *
 * Renders a text input and shows product cards in a grid. Clicking a card
 * adds it to the cart (if no variants) or opens the variant selector.
 */
import { useState } from "react";
import { Search } from "lucide-react";
import { searchProducts } from "./cashier.service";
import { useCartStore } from "./useCart";
import type { Product, Variant } from "../catalog/catalog.service";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

interface Props {
  products: Product[];
  variants: Variant[];
}

export function ProductSearch({ products, variants }: Props) {
  const [query, setQuery] = useState("");
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const results = searchProducts(query, products);

  function handleProductClick(product: Product) {
    if (product.has_variants) {
      setVariantProduct(product);
    } else {
      const inCart = cartItems.find(
        (i) => i.productId === product.id && !i.variantId,
      );
      const currentQty = inCart ? inCart.quantity : 0;
      if (product.stock !== undefined && currentQty >= product.stock) {
        // Minimal user feedback; keep UI changes small for MVP.
        // Commit-side validation will still prevent oversell.
        alert("Stok tidak cukup untuk menambahkan produk ini ke keranjang");
        return;
      }
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
      });
    }
  }

  function handleVariantClick(variant: Variant, product: Product) {
    const inCart = cartItems.find((i) => i.variantId === variant.id);
    const currentQty = inCart ? inCart.quantity : 0;
    if (variant.stock !== undefined && currentQty >= variant.stock) {
      alert("Stok varian tidak cukup untuk menambahkan ini ke keranjang");
      return;
    }
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: `${product.name} – ${variant.option_name}: ${variant.option_value}`,
      price: variant.price,
    });
    setVariantProduct(null);
  }

  const productVariants = variantProduct
    ? variants.filter((v) => v.product_id === variantProduct.id)
    : [];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Search input */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Cari produk atau SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
          aria-label="Cari produk"
          data-testid="product-search-input"
        />
      </div>

      {/* Variant selector dialog */}
      {variantProduct && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setVariantProduct(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Pilih Varian — {variantProduct.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {productVariants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleVariantClick(v, variantProduct)}
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-blue-50 text-sm"
                >
                  <span>
                    {v.option_name}: {v.option_value}
                  </span>
                  <span className="font-semibold text-blue-700">
                    Rp {v.price.toLocaleString("id-ID")}
                  </span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setVariantProduct(null)}
              className="w-full"
            >
              Batal
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Product grid — fills remaining height and scrolls */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1 min-h-0 overflow-y-auto content-start"
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
            data-testid={`product-card-${product.id}`}
            onClick={() => handleProductClick(product)}
            disabled={!product.has_variants && product.stock <= 0}
            className="flex flex-col items-start p-3 border rounded-lg text-left text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="font-medium leading-tight">{product.name}</span>
            {product.sku && (
              <span className="text-xs text-gray-400 mt-0.5">
                {product.sku}
              </span>
            )}
            <span className="mt-1 font-semibold text-blue-700">
              Rp {product.price.toLocaleString("id-ID")}
            </span>
            {!product.has_variants && (
              <span
                className={`text-xs mt-0.5 ${product.stock <= 5 ? "text-orange-500" : "text-gray-400"}`}
              >
                Stok: {product.stock}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
