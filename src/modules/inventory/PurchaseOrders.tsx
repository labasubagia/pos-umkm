/**
 * PurchaseOrders.tsx — Purchase order management UI.
 *
 * Orders come from usePurchaseOrders() (React Query).
 * Products for the form come from useProducts() (React Query).
 * Mutations invalidate the relevant queries.
 *
 * T035 deliverable.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { usePurchaseOrders, PURCHASE_ORDERS_QUERY_KEY } from '../../hooks/usePurchaseOrders'
import { useProducts, PRODUCTS_QUERY_KEY } from '../../hooks/useProducts'
import { formatDate } from '../../lib/formatDate'
import { formatIDR } from '../../lib/formatIDR'
import {
  fetchPurchaseOrderItems,
  createPurchaseOrder,
  receivePurchaseOrder,
  InventoryError,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderItemRow,
} from './inventory.service'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'

export function PurchaseOrders() {
  const queryClient = useQueryClient()
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  const { data: orders = [], isLoading, error: fetchError } = usePurchaseOrders()
  const { data: products = [] } = useProducts()

  // New order form state
  const [showForm, setShowForm] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [formItems, setFormItems] = useState<PurchaseOrderItem[]>([
    { product_id: '', product_name: '', qty: 1, cost_price: 0 },
  ])
  const [formError, setFormError] = useState<string | null>(null)

  // Detail view state
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [detailItems, setDetailItems] = useState<PurchaseOrderItemRow[]>([])
  const [receivingId, setReceivingId] = useState<string | null>(null)

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY(activeStoreId) })
  const invalidateProducts = () =>
    queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY(activeStoreId) })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!supplier.trim()) throw new Error('Nama supplier wajib diisi')
      const validItems = formItems.filter((i) => i.product_id)
      if (validItems.length === 0) throw new Error('Tambahkan minimal 1 produk ke purchase order')
      return createPurchaseOrder(supplier, validItems)
    },
    onSuccess: () => {
      setShowForm(false)
      setFormError(null)
      void invalidateOrders()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const receiveMutation = useMutation({
    mutationFn: (orderId: string) => receivePurchaseOrder(orderId),
    onMutate: (orderId) => setReceivingId(orderId),
    onSuccess: () => {
      setDetailOrder(null)
      setReceivingId(null)
      void invalidateOrders()
      void invalidateProducts()
    },
    onError: (err) => setReceivingId(null),
  })

  function openForm() {
    setSupplier('')
    setFormItems([{ product_id: '', product_name: '', qty: 1, cost_price: 0 }])
    setFormError(null)
    setShowForm(true)
  }

  function handleItemChange(index: number, field: keyof PurchaseOrderItem, value: string | number) {
    setFormItems((prev) => {
      const next = [...prev]
      if (field === 'product_id') {
        const product = products.find((p) => p.id === value)
        next[index] = { ...next[index], product_id: value as string, product_name: product?.name ?? '' }
      } else {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
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

  const errorMsg = fetchError instanceof Error ? fetchError.message : null

  if (isLoading) {
    return <p data-testid="po-loading" className="text-sm text-gray-500">Memuat purchase order…</p>
  }

  return (
    <div data-testid="purchase-orders-container">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Purchase Order</h2>
        <Button data-testid="btn-create-po" onClick={openForm}>
          + Buat PO Baru
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="mb-3" data-testid="po-error">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* ── New PO Form ────────────────────────────────────────────────── */}
      {showForm && (
        <div data-testid="po-form" className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 font-medium">Purchase Order Baru</h3>

          <div className="mb-3 space-y-1.5">
            <Label>Supplier</Label>
            <Input
              data-testid="input-po-supplier"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Nama supplier"
            />
          </div>

          <div className="mb-3 space-y-2">
            {formItems.map((item, idx) => (
              <div key={idx} data-testid={`po-item-row-${idx}`} className="flex items-center gap-2">
                <select
                  data-testid={`select-po-product-${idx}`}
                  value={item.product_id}
                  onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
                >
                  <option value="">— Pilih Produk —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                  data-testid={`input-po-qty-${idx}`}
                  placeholder="Qty"
                  className="w-20"
                />
                <Input
                  type="number"
                  min={0}
                  value={item.cost_price}
                  onChange={(e) => handleItemChange(idx, 'cost_price', parseInt(e.target.value, 10) || 0)}
                  data-testid={`input-po-cost-${idx}`}
                  placeholder="Harga modal"
                  className="w-32"
                />
                {formItems.length > 1 && (
                  <button
                    data-testid={`btn-remove-po-item-${idx}`}
                    onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
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
            onClick={() => setFormItems((prev) => [...prev, { product_id: '', product_name: '', qty: 1, cost_price: 0 }])}
            className="mb-3 text-sm text-blue-600 hover:underline"
          >
            + Tambah Item
          </button>

          {formError && (
            <Alert variant="destructive" className="mb-2" data-testid="po-form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button data-testid="btn-submit-po" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan PO'}
            </Button>
            <Button variant="outline" data-testid="btn-cancel-po" onClick={() => setShowForm(false)}>
              Batal
            </Button>
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
                <p data-testid={`po-supplier-${order.id}`} className="font-medium">{order.supplier}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(order.created_at, 'DD MMM YYYY')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  data-testid={`po-status-${order.id}`}
                  className={order.status === 'received'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-yellow-100 text-yellow-700 border-yellow-200'}
                >
                  {order.status === 'received' ? 'Diterima' : 'Pending'}
                </Badge>
                <Button variant="ghost" size="sm" data-testid={`btn-view-po-${order.id}`} onClick={() => openDetail(order)}>
                  Detail
                </Button>
                {order.status === 'pending' && (
                  <Button
                    size="sm"
                    data-testid={`btn-receive-po-${order.id}`}
                    onClick={() => receiveMutation.mutate(order.id)}
                    disabled={receivingId === order.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {receivingId === order.id ? 'Memproses…' : 'Terima'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      {detailOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setDetailOrder(null) }}>
          <DialogContent className="max-w-lg" data-testid="po-detail-modal">
            <DialogHeader>
              <DialogTitle>Detail PO — {detailOrder.supplier}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Harga Modal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailItems.map((item) => (
                  <TableRow key={item.id} data-testid={`po-detail-item-${item.id}`}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">{formatIDR(item.cost_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {detailOrder.status === 'pending' && (
              <Button
                data-testid={`btn-receive-po-detail-${detailOrder.id}`}
                onClick={() => receiveMutation.mutate(detailOrder.id)}
                disabled={receivingId === detailOrder.id}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {receivingId === detailOrder.id ? 'Memproses…' : 'Terima & Tambah Stok'}
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
