/**
 * CartPanel.tsx — Active cart items list for the cashier screen.
 *
 * Displays items, quantities (with +/- controls), and line totals.
 * Calls useCartStore actions — all purely in-memory.
 */
import { Trash2 } from "lucide-react";
import { useCartStore } from "./useCart";
import { calculateSubtotal } from "./cashier.service";
import { Button } from "../../components/ui/button";
import { useProducts } from "../../hooks/useProducts";
import { useVariants } from "../../hooks/useVariants";

export function CartPanel() {
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const { data: products = [] } = useProducts();
  const { data: variants = [] } = useVariants();

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-12">
        Keranjang kosong — pilih produk di sebelah kiri
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
      {items.map((item) => (
        <div
          key={`${item.productId}-${item.variantId ?? ""}`}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50"
        >
          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-gray-500">
              Rp {item.price.toLocaleString("id-ID")} / pcs
            </p>
          </div>

          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setQuantity(item.productId, item.quantity - 1, item.variantId)
              }
              aria-label={`Kurangi ${item.name}`}
            >
              −
            </Button>
            <span className="w-8 text-center text-sm font-semibold">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setQuantity(item.productId, item.quantity + 1, item.variantId)
              }
              aria-label={`Tambah ${item.name}`}
              disabled={(() => {
                // Determine available stock for this cart line
                const available = item.variantId
                  ? (variants.find((v) => v.id === item.variantId)?.stock ?? 0)
                  : (products.find((p) => p.id === item.productId)?.stock ?? 0);
                return item.quantity >= available;
              })()}
            >
              +
            </Button>
          </div>

          {/* Line total */}
          <span className="w-20 text-right text-sm font-semibold">
            Rp {(item.price * item.quantity).toLocaleString("id-ID")}
          </span>

          {/* Remove */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              // Remove all units at once
              setQuantity(item.productId, 0, item.variantId);
            }}
            className="text-gray-300 hover:text-red-500"
            aria-label={`Hapus ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Subtotal row */}
      <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
        <span>Subtotal</span>
        <span>Rp {calculateSubtotal(items).toLocaleString("id-ID")}</span>
      </div>
    </div>
  );
}
