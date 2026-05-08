/**
 * ProductSearch.tsx — Product search grid for the cashier screen (T026).
 *
 * Renders a text input and shows product cards in a grid. Clicking a card
 * adds it to the cart (if no variants) or opens the variant selector.
 * Uses Fuse.js for fuzzy search with pre-indexed search results.
 */

import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import type { Product, Variant } from "../catalog/catalog.service";
import { useCartStore } from "./useCart";

interface Props {
  products: Product[];
  variants: Variant[];
}

/**
 * Renders text with highlighted matches based on Fuse.js indices.
 * Indices are character positions where matches occur.
 */
function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices?: ReadonlyArray<[number, number]>;
}) {
  if (!indices || indices.length === 0) {
    return <>{text}</>;
  }

  const parts: Array<{
    text: string;
    highlight: boolean;
    startPos: number;
  }> = [];
  let lastEnd = 0;

  indices.forEach(([start, end]) => {
    if (start > lastEnd) {
      parts.push({
        text: text.substring(lastEnd, start),
        highlight: false,
        startPos: lastEnd,
      });
    }
    parts.push({
      text: text.substring(start, end + 1),
      highlight: true,
      startPos: start,
    });
    lastEnd = end + 1;
  });

  if (lastEnd < text.length) {
    parts.push({
      text: text.substring(lastEnd),
      highlight: false,
      startPos: lastEnd,
    });
  }

  return (
    <>
      {parts.map((part) => (
        <span
          key={`${part.startPos}-${part.highlight}`}
          className={part.highlight ? "bg-amber-300 font-semibold" : ""}
        >
          {part.text}
        </span>
      ))}
    </>
  );
}

export function ProductSearch({ products, variants }: Props) {
  const [query, setQuery] = useState("");
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  // Pre-index products for fuzzy search (rebuilt only when products array changes)
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "sku", weight: 0.3 },
      ],
      threshold: 0.4,
      includeMatches: true,
      includeScore: true,
    });
  }, [products]);

  // Perform fuzzy search
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return products.map((product) => ({
        product,
        matches: undefined,
      }));
    }
    return fuse.search(query).map((result) => ({
      product: result.item as Product,
      matches: result.matches,
    }));
  }, [query, fuse, products]);

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
                  type="button"
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
      <ul
        className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1 min-h-0 overflow-y-auto content-start"
        aria-label="Daftar produk"
      >
        {searchResults.length === 0 && (
          <p className="col-span-full text-center text-sm text-gray-400 py-8">
            Produk tidak ditemukan
          </p>
        )}
        {searchResults.map(({ product, matches }) => {
          const nameMatch = matches?.find((m) => m.key === "name");
          const skuMatch = matches?.find((m) => m.key === "sku");

          return (
            <li key={product.id}>
              <button
                type="button"
                data-testid={`product-card-${product.id}`}
                onClick={() => handleProductClick(product)}
                disabled={!product.has_variants && product.stock <= 0}
                className="w-full flex flex-col items-start p-3 border rounded-lg text-left text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium leading-tight">
                  <HighlightedText
                    text={product.name}
                    indices={nameMatch?.indices}
                  />
                </span>
                {product.sku && (
                  <span className="text-xs text-gray-400 mt-0.5">
                    <HighlightedText
                      text={product.sku}
                      indices={skuMatch?.indices}
                    />
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
