/**
 * PurchaseOrders.tsx — Purchase order management UI.
 *
 * Displays the list of purchase orders and a form to create new ones.
 * The owner can mark a pending order as "received" to increment stock.
 *
 * T035 deliverable.
 */
import { useEffect, useState, useCallback } from 'react'
import { formatIDR } from '../../lib/formatIDR'
import {
  fetchPurchaseOrders,
  fetchPurchaseOrderItems,
  createPurchaseOrder,
  receivePurchaseOrder,
  InventoryError,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderItemRow,
} from './inventory.service'
import { fetchProducts } from '../catalog/catalog.service'
import type { Product } from '../catalog/catalog.service'

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New order form state
  const [showForm, setShowForm] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [supplier, setSupplier] = useState('')
  const [formItems, setFormItems] = useState<PurchaseOrderItem[]>([
    { product_id: '', product_name: '', qty: 1, cost_price: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Detail view state
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [detailItems, setDetailItems] = useState<PurchaseOrderItemRow[]>([])
  const [receivingId, setReceivingId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPurchaseOrders()
      setOrders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat purchase order')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  async function openForm() {
    try {
      const prods = await fetchProducts()
      setProducts(prods)
    } catch {
      setProducts([])
    }
    setSupplier('')
    setFormItems([{ product_id: '', product_name: '', qty: 1, cost_price: 0 }])
    setFormError(null)
    setShowForm(true)
  }

  function handleItemChange(
    index: number,
    field: keyof PurchaseOrderItem,
    value: string | number,
  ) {
    setFormItems((prev) => {
      const next = [...prev]
      if (field === 'product_id') {
        const product = products.find((p) => p.id === value)
        next[index] = {
          ...next[index],
          product_id: value as string,
          product_name: product?.name ?? '',
        }
      } else {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
  }

  function addItem() {
    setFormItems((prev) => [...prev, { product_id: '', product_name: '', qty: 1, cost_price: 0 }])
  }

  function removeItem(index: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmitOrder() {
    setFormError(null)
    if (!supplier.trim()) {
      setFormError('Nama supplier wajib diisi')
      return
    }
    const validItems = formItems.filter((i) => i.product_id)
    if (validItems.length === 0) {
      setFormError('Tambahkan minimal 1 produk ke purchase order')
      return
    }
    setSubmitting(true)
    try {
      await createPurchaseOrder(supplier, validItems)
      setShowForm(false)
      await loadOrders()
    } catch (err) {
      setFormError(err instanceof InventoryError ? err.message : 'Gagal membuat purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(order: PurchaseOrder) {
    setDetailOrder(order)
    try {
      const items = await fetchPurchaseOrderItems(order.id)
      setDetailItems(items)
    } catch {
      setDetailItems([])
    }
  }

  async function handleReceive(orderId: string) {
    setReceivingId(orderId)
    setError(null)
    try {
      await receivePurchaseOrder(orderId)
      setDetailOrder(null)
      await loadOrders()
    } catch (err) {
      setError(err instanceof InventoryError ? err.message : 'Gagal menerima purchase order')
    } finally {
      setReceivingId(null)
    }
  }

  if (loading) {
    return <p data-testid="po-loading" className="text-sm text-gray-500">Memuat purchase order…</p>
  }

  return (
    <div data-testid="purchase-orders-container">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Purchase Order</h2>
        <button
          data-testid="btn-create-po"
          onClick={openForm}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Buat PO Baru
        </button>
      </div>

      {error && (
        <p data-testid="po-error" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── New PO Form ────────────────────────────────────────────────── */}
      {showForm && (
        <div
          data-testid="po-form"
          className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <h3 className="mb-3 font-medium">Purchase Order Baru</h3>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Supplier</label>
            <input
              data-testid="input-po-supplier"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Nama supplier"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-3 space-y-2">
            {formItems.map((item, idx) => (
              <div
                key={idx}
                data-testid={`po-item-row-${idx}`}
                className="flex items-center gap-2"
              >
                <select
                  data-testid={`select-po-product-${idx}`}
                  value={item.product_id}
                  onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">— Pilih Produk —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                  data-testid={`input-po-qty-${idx}`}
                  placeholder="Qty"
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={item.cost_price}
                  onChange={(e) =>
                    handleItemChange(idx, 'cost_price', parseInt(e.target.value, 10) || 0)
                  }
                  data-testid={`input-po-cost-${idx}`}
                  placeholder="Harga modal"
                  className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                {formItems.length > 1 && (
                  <button
                    data-testid={`btn-remove-po-item-${idx}`}
                    onClick={() => removeItem(idx)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Hapus item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            data-testid="btn-add-po-item"
            onClick={addItem}
            className="mb-3 text-sm text-blue-600 hover:underline"
          >
            + Tambah Item
          </button>

          {formError && (
            <p data-testid="po-form-error" className="mb-2 text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              data-testid="btn-submit-po"
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan…' : 'Simpan PO'}
            </button>
            <button
              data-testid="btn-cancel-po"
              onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ── Order List ─────────────────────────────────────────────────── */}
      {orders.length === 0 ? (
        <p data-testid="po-empty" className="text-sm text-gray-500">
          Belum ada purchase order. Klik "Buat PO Baru" untuk memulai.
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              data-testid={`po-row-${order.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <p
                  data-testid={`po-supplier-${order.id}`}
                  className="font-medium"
                >
                  {order.supplier}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  data-testid={`po-status-${order.id}`}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    order.status === 'received'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {order.status === 'received' ? 'Diterima' : 'Pending'}
                </span>

                <button
                  data-testid={`btn-view-po-${order.id}`}
                  onClick={() => openDetail(order)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Detail
                </button>

                {order.status === 'pending' && (
                  <button
                    data-testid={`btn-receive-po-${order.id}`}
                    onClick={() => handleReceive(order.id)}
                    disabled={receivingId === order.id}
                    className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {receivingId === order.id ? 'Memproses…' : 'Terima'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      {detailOrder && (
        <div
          data-testid="po-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Detail PO — {detailOrder.supplier}</h3>
              <button
                data-testid="btn-close-po-detail"
                onClick={() => setDetailOrder(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 font-medium">Produk</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Harga Modal</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={item.id} data-testid={`po-detail-item-${item.id}`} className="border-b">
                    <td className="py-2">{item.product_name}</td>
                    <td className="py-2 text-right">{item.qty}</td>
                    <td className="py-2 text-right">{formatIDR(item.cost_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detailOrder.status === 'pending' && (
              <button
                data-testid={`btn-receive-po-detail-${detailOrder.id}`}
                onClick={() => handleReceive(detailOrder.id)}
                disabled={receivingId === detailOrder.id}
                className="mt-4 w-full rounded bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {receivingId === detailOrder.id ? 'Memproses…' : 'Terima & Tambah Stok'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
