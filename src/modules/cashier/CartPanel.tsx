/**
 * CartPanel.tsx — Active cart items list for the cashier screen.
 *
 * Displays items, quantities (with +/- controls), and line totals.
 * Calls useCartStore actions — all purely in-memory.
 */
import { Trash2 } from 'lucide-react'
import { useCartStore } from './useCart'
import { calculateSubtotal } from './cashier.service'

export function CartPanel() {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const setQuantity = useCartStore((s) => s.setQuantity)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-12">
        Keranjang kosong — pilih produk di sebelah kiri
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
      {items.map((item) => (
        <div
          key={`${item.productId}-${item.variantId ?? ''}`}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50"
        >
          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-gray-500">
              Rp {item.price.toLocaleString('id-ID')} / pcs
            </p>
          </div>

          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuantity(item.productId, item.quantity - 1, item.variantId)}
              className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:bg-gray-100"
              aria-label={`Kurangi ${item.name}`}
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
            <button
              onClick={() => setQuantity(item.productId, item.quantity + 1, item.variantId)}
              className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:bg-gray-100"
              aria-label={`Tambah ${item.name}`}
            >
              +
            </button>
          </div>

          {/* Line total */}
          <span className="w-20 text-right text-sm font-semibold">
            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
          </span>

          {/* Remove */}
          <button
            onClick={() => {
              // Remove all units at once
              setQuantity(item.productId, 0, item.variantId)
            }}
            className="text-gray-300 hover:text-red-500 transition-colors"
            aria-label={`Hapus ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Subtotal row */}
      <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
        <span>Subtotal</span>
        <span>Rp {calculateSubtotal(items).toLocaleString('id-ID')}</span>
      </div>
    </div>
  )
}
