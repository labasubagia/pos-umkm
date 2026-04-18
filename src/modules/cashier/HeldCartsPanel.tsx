/**
 * HeldCartsPanel.tsx — Panel listing held carts (T031).
 *
 * Shows held carts with item count and time. Tapping a row restores it
 * (replaces the current active cart).
 */
import { ShoppingBag, Clock } from 'lucide-react'
import { useCartStore } from './useCart'
import { formatDateTime } from '../../lib/formatters'

export function HeldCartsPanel() {
  const heldCarts = useCartStore((s) => s.heldCarts)
  const retrieveCart = useCartStore((s) => s.retrieveCart)
  const holdCart = useCartStore((s) => s.holdCart)
  const items = useCartStore((s) => s.items)

  if (heldCarts.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Tidak ada keranjang yang ditahan
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
          <ShoppingBag className="h-4 w-4" />
          Keranjang Tertahan ({heldCarts.length})
        </h3>
        {items.length > 0 && (
          <button
            onClick={() => holdCart()}
            className="text-xs text-blue-600 hover:underline"
          >
            Tahan Saat Ini
          </button>
        )}
      </div>

      {heldCarts.map((cart, i) => (
        <button
          key={cart.heldAt}
          onClick={() => retrieveCart(i)}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-blue-50 text-left text-sm transition-colors"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{cart.items.length} produk</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatDateTime(cart.heldAt, 'Asia/Jakarta')}
            </span>
          </div>
          <span className="text-blue-600 font-semibold text-xs">Ambil</span>
        </button>
      ))}
    </div>
  )
}
