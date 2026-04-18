/**
 * CashierPage.tsx — Main cashier/POS screen (T025–T033, T036).
 *
 * Layout:
 *   Left panel: ProductSearch (product grid + search)
 *   Right panel: CustomerSearch + CartPanel + DiscountInput + action buttons
 *   Overlays: PaymentModal, ReceiptModal, HeldCartsPanel drawer
 */
import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useCatalogStore } from '../modules/catalog/useCatalog'
import { useCartStore } from '../modules/cashier/useCart'
import { ProductSearch } from '../modules/cashier/ProductSearch'
import { CartPanel } from '../modules/cashier/CartPanel'
import { DiscountInput } from '../modules/cashier/DiscountInput'
import { PaymentModal } from '../modules/cashier/PaymentModal'
import { ReceiptModal } from '../modules/cashier/ReceiptModal'
import { HeldCartsPanel } from '../modules/cashier/HeldCartsPanel'
import { CustomerSearch } from '../modules/customers/CustomerSearch'
import type { Customer } from '../modules/customers/customers.service'
import {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateTotal,
  commitTransaction,
  CashierError,
} from '../modules/cashier/cashier.service'
import { getQRISImageUrl } from '../modules/settings/settings.service'
import type { Transaction, TransactionItem, PaymentInfo } from '../modules/cashier/cashier.service'

const TAX_RATE = 0 // PPN disabled by default; owner can enable in Settings (post-MVP)

export default function CashierPage() {
  const { user, spreadsheetId } = useAuthStore()
  const { products, variants, loadCatalog } = useCatalogStore()
  const { items, discount, resetCart, holdCart } = useCartStore()
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [qrisImageUrl, setQrisImageUrl] = useState('')
  const [completedTransaction, setCompletedTransaction] = useState<{ tx: Transaction; txItems: TransactionItem[] } | null>(null)
  const [txError, setTxError] = useState('')
  const [receiptSeq, setReceiptSeq] = useState(1)

  useEffect(() => {
    loadCatalog()
    getQRISImageUrl().then(setQrisImageUrl).catch(() => {})
  }, [loadCatalog])

  const subtotal = calculateSubtotal(items)
  const discountAmount = discount
    ? (() => { try { return applyDiscount(subtotal, discount) } catch { return 0 } })()
    : 0
  const tax = calculateTax(subtotal - discountAmount, TAX_RATE)
  const total = calculateTotal(subtotal, discountAmount, tax)

  async function handlePaymentConfirm(payment: PaymentInfo) {
    if (!user || !spreadsheetId) return
    setTxError('')
    try {
      const tx = await commitTransaction(
        items,
        discount,
        TAX_RATE,
        payment,
        user.id,
        selectedCustomer?.id ?? null,
        spreadsheetId,
        receiptSeq,
      )
      setReceiptSeq((s) => s + 1)
      setSelectedCustomer(null)

      // Build TransactionItem list for receipt (derived from cart + tx id)
      const txItems: TransactionItem[] = items.map((item, i) => ({
        id: `item-${i}`,
        transaction_id: tx.id,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      }))

      setCompletedTransaction({ tx, txItems })
      setShowPayment(false)
      resetCart()
    } catch (err) {
      if (err instanceof CashierError) {
        setTxError(err.message)
      } else {
        setTxError('Terjadi kesalahan saat memproses transaksi')
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 bg-gray-50">
      {/* Left — product search */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <h1 className="text-lg font-bold mb-3">Kasir</h1>
        <ProductSearch products={products} variants={variants} />
      </div>

      {/* Right — cart + actions */}
      <div className="w-80 bg-white border-l flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-3 border-b">
          <h2 className="font-semibold text-sm">Keranjang</h2>
          <button
            onClick={() => setShowHeld(!showHeld)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            data-testid="btn-held-toggle"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Tahan
          </button>
        </div>

        {/* Customer search */}
        <div className="px-3 py-2 border-b">
          <CustomerSearch onSelect={setSelectedCustomer} />
          {selectedCustomer && (
            <p
              className="mt-1 text-xs font-medium text-blue-700"
              data-testid="cart-customer-name"
            >
              {selectedCustomer.name}
            </p>
          )}
        </div>

        {/* Held carts panel (toggleable) */}
        {showHeld && (
          <div className="p-3 border-b bg-gray-50">
            <HeldCartsPanel />
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col">
          <CartPanel />
        </div>

        {/* Discount */}
        <div className="px-3 pb-2 border-t pt-2">
          <DiscountInput />
        </div>

        {/* Total + action buttons */}
        <div className="p-3 border-t bg-gray-50">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Subtotal</span>
            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm mb-1 text-green-600">
              <span>Diskon</span>
              <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm mb-1 text-gray-500">
              <span>PPN {TAX_RATE}%</span>
              <span>Rp {tax.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base mt-2 mb-3">
            <span>Total</span>
            <span className="text-blue-700">Rp {total.toLocaleString('id-ID')}</span>
          </div>

          {txError && <p className="text-xs text-red-500 mb-2">{txError}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => { try { holdCart() } catch (e) { setTxError((e as Error).message) } }}
              disabled={items.length === 0}
              className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40"
              data-testid="btn-hold-cart"
            >
              Tahan
            </button>
            <button
              onClick={() => setShowPayment(true)}
              disabled={items.length === 0}
              className="flex-[2] py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-40"
              data-testid="btn-pay"
            >
              Bayar Rp {total.toLocaleString('id-ID')}
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          qrisImageUrl={qrisImageUrl}
          taxRate={TAX_RATE}
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* Receipt modal */}
      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction.tx}
          items={completedTransaction.txItems}
          businessName="POS UMKM"
          timezone="Asia/Jakarta"
          onClose={() => setCompletedTransaction(null)}
        />
      )}
    </div>
  )
}

