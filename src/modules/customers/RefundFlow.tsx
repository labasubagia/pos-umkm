/**
 * RefundFlow.tsx — UI for processing refunds on completed transactions.
 *
 * Allows the owner/manager to:
 *   1. Look up a transaction by ID.
 *   2. Select which items (and how many) are being returned.
 *   3. Provide a reason and submit the refund.
 *
 * Stock is automatically re-incremented by refund.service.createRefund().
 */

import { useState } from 'react'
import { fetchTransaction, createRefund, RefundItem, RefundError } from './refund.service'
import type { Transaction } from '../cashier/cashier.service'
import { formatIDR } from '../../lib/formatters'

interface ItemEntry {
  product_id: string
  product_name: string
  unit_price: number
  originalQty: number
  refundQty: number
}

export function RefundFlow() {
  const [txIdInput, setTxIdInput] = useState('')
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [items, setItems] = useState<ItemEntry[]>([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [findError, setFindError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleFind() {
    setFindError(null)
    setTransaction(null)
    setItems([])
    setSuccess(false)
    setLoading(true)
    try {
      const tx = await fetchTransaction(txIdInput.trim())
      setTransaction(tx)
      // For MVP, we don't load line items from Transaction_Items — user inputs qty manually
      setItems([])
    } catch (err) {
      setFindError(err instanceof RefundError ? err.message : 'Transaksi tidak ditemukan')
    } finally {
      setLoading(false)
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: '', product_name: '', unit_price: 0, originalQty: 1, refundQty: 1 },
    ])
  }

  function updateItem(index: number, field: keyof ItemEntry, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setSubmitError(null)
    if (!transaction) return
    if (items.length === 0) {
      setSubmitError('Pilih minimal satu item untuk direfund')
      return
    }
    if (!reason.trim()) {
      setSubmitError('Alasan refund wajib diisi')
      return
    }

    const refundItems: RefundItem[] = items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      qty: item.refundQty,
      unit_price: item.unit_price,
    }))

    setLoading(true)
    try {
      await createRefund(transaction.id, refundItems, reason.trim())
      setSuccess(true)
    } catch (err) {
      setSubmitError(err instanceof RefundError ? err.message : 'Gagal memproses refund')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-6 text-center"
        data-testid="refund-success"
      >
        <p className="text-lg font-semibold text-green-700">✓ Refund berhasil diproses</p>
        <p className="mt-1 text-sm text-green-600">Stok telah dikembalikan.</p>
        <button
          type="button"
          className="mt-4 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          onClick={() => {
            setSuccess(false)
            setTransaction(null)
            setTxIdInput('')
            setItems([])
            setReason('')
          }}
        >
          Refund Lainnya
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Transaction lookup */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">ID Transaksi</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Masukkan ID transaksi atau nomor struk..."
            value={txIdInput}
            onChange={(e) => setTxIdInput(e.target.value)}
            data-testid="refund-tx-id-input"
          />
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={handleFind}
            disabled={loading || !txIdInput.trim()}
            data-testid="btn-find-transaction"
          >
            Cari
          </button>
        </div>
        {findError && (
          <p className="text-sm text-red-600" data-testid="refund-error">
            {findError}
          </p>
        )}
      </div>

      {/* Transaction info */}
      {transaction && (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          data-testid="refund-tx-info"
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">No. Struk</dt>
            <dd className="font-medium">{transaction.receipt_number}</dd>
            <dt className="text-gray-500">Total</dt>
            <dd className="font-medium">{formatIDR(transaction.total)}</dd>
            <dt className="text-gray-500">Tanggal</dt>
            <dd>{new Date(transaction.created_at).toLocaleDateString('id-ID')}</dd>
          </dl>
        </div>
      )}

      {/* Item entries */}
      {transaction && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Item yang Dikembalikan</h3>
            <button
              type="button"
              className="rounded border border-blue-600 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50"
              onClick={addItem}
              data-testid="btn-add-refund-item"
            >
              + Tambah Item
            </button>
          </div>

          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 rounded border border-gray-200 p-3 text-sm"
              data-testid={`refund-item-row-${index}`}
            >
              <input
                className="col-span-4 rounded border border-gray-300 px-2 py-1"
                placeholder="Nama produk"
                value={item.product_name}
                onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                data-testid={`refund-item-name-${index}`}
              />
              <input
                className="col-span-2 rounded border border-gray-300 px-2 py-1"
                placeholder="ID produk"
                value={item.product_id}
                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                data-testid={`refund-item-product-id-${index}`}
              />
              <input
                className="col-span-2 rounded border border-gray-300 px-2 py-1"
                type="number"
                placeholder="Harga"
                value={item.unit_price || ''}
                onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                data-testid={`refund-item-price-${index}`}
              />
              <input
                className="col-span-2 rounded border border-gray-300 px-2 py-1"
                type="number"
                min={1}
                placeholder="Qty"
                value={item.refundQty}
                onChange={(e) => updateItem(index, 'refundQty', Number(e.target.value))}
                data-testid={`refund-item-qty-${index}`}
              />
              <button
                type="button"
                className="col-span-2 rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                onClick={() => removeItem(index)}
                data-testid={`btn-remove-refund-item-${index}`}
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reason */}
      {transaction && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Alasan Pengembalian</label>
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Contoh: Produk rusak, salah pesanan..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="refund-reason-input"
          />
        </div>
      )}

      {/* Submit */}
      {transaction && (
        <div>
          {submitError && (
            <p className="mb-2 text-sm text-red-600" data-testid="refund-error">
              {submitError}
            </p>
          )}
          <button
            type="button"
            className="w-full rounded bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            data-testid="btn-submit-refund"
          >
            {loading ? 'Memproses...' : 'Proses Refund'}
          </button>
        </div>
      )}
    </div>
  )
}

export default RefundFlow
