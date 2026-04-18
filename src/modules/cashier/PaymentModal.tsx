/**
 * PaymentModal.tsx — Full payment flow modal (T027, T028, T030).
 *
 * Steps:
 *   1. Method selection (CASH / QRIS / SPLIT)
 *   2. Method-specific input (cash amount, QRIS image, or split amounts)
 *   3. Confirm → calls onConfirm with payment info
 *
 * The parent (CashierPage) is responsible for calling commitTransaction.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateTotal,
  calculateChange,
  suggestDenominations,
  validateSplitPayment,
  SplitPaymentError,
} from './cashier.service'
import { useCartStore } from './useCart'
import type { PaymentInfo } from './cashier.service'

interface Props {
  qrisImageUrl: string
  taxRate: number
  onConfirm: (payment: PaymentInfo) => void
  onClose: () => void
}

type Step = 'method' | 'cash' | 'qris' | 'split'

export function PaymentModal({ qrisImageUrl, taxRate, onConfirm, onClose }: Props) {
  const items = useCartStore((s) => s.items)
  const discount = useCartStore((s) => s.discount)

  const subtotal = calculateSubtotal(items)
  const discountAmount = discount
    ? (() => { try { return applyDiscount(subtotal, discount) } catch { return 0 } })()
    : 0
  const tax = calculateTax(subtotal - discountAmount, taxRate)
  const total = calculateTotal(subtotal, discountAmount, tax)

  const [step, setStep] = useState<Step>('method')
  const [cashInput, setCashInput] = useState('')
  const [splitCash, setSplitCash] = useState('')
  const [splitQris, setSplitQris] = useState('')
  const [error, setError] = useState('')

  const cashAmount = parseInt(cashInput, 10) || 0
  const splitCashAmount = parseInt(splitCash, 10) || 0
  const splitQrisAmount = parseInt(splitQris, 10) || 0

  function handleCashConfirm() {
    try {
      const change = calculateChange(total, cashAmount)
      onConfirm({ method: 'CASH', cashReceived: cashAmount, change })
    } catch {
      setError('Uang diterima kurang dari total. Harap masukkan jumlah yang cukup.')
    }
  }

  function handleSplitConfirm() {
    try {
      validateSplitPayment(splitCashAmount, splitQrisAmount, total)
      onConfirm({ method: 'SPLIT', cashReceived: splitCashAmount + splitQrisAmount, change: 0, splitCash: splitCashAmount, splitQris: splitQrisAmount })
    } catch (e) {
      if (e instanceof SplitPaymentError) {
        setError(e.message)
      } else {
        setError('Terjadi kesalahan saat validasi pembayaran split')
      }
    }
  }

  const denominations = suggestDenominations(total)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Pembayaran</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Total display */}
        <div className="px-4 pt-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Pembayaran</p>
            <p className="text-3xl font-bold text-blue-700">Rp {total.toLocaleString('id-ID')}</p>
            {discountAmount > 0 && (
              <p className="text-xs text-green-600 mt-1">Termasuk diskon Rp {discountAmount.toLocaleString('id-ID')}</p>
            )}
            {tax > 0 && (
              <p className="text-xs text-gray-400">PPN {taxRate}%: Rp {tax.toLocaleString('id-ID')}</p>
            )}
          </div>
        </div>

        {/* Step: method selection */}
        {step === 'method' && (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-sm text-gray-600 font-medium">Pilih Metode Pembayaran</p>
            <button
              onClick={() => setStep('cash')}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
            >
              <p className="font-semibold">💵 Tunai</p>
              <p className="text-xs text-gray-400">Hitung kembalian otomatis</p>
            </button>
            <button
              onClick={() => setStep('qris')}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
            >
              <p className="font-semibold">📱 QRIS</p>
              <p className="text-xs text-gray-400">Tampilkan QR code ke pelanggan</p>
            </button>
            <button
              onClick={() => setStep('split')}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
            >
              <p className="font-semibold">✂️ Split (Tunai + QRIS)</p>
              <p className="text-xs text-gray-400">Sebagian tunai, sebagian QRIS</p>
            </button>
          </div>
        )}

        {/* Step: cash payment */}
        {step === 'cash' && (
          <div className="p-4 flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">Uang Diterima</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
              <input
                type="number"
                min={total}
                value={cashInput}
                onChange={(e) => { setCashInput(e.target.value); setError('') }}
                placeholder={String(total)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Uang diterima"
                autoFocus
              />
            </div>

            {/* Quick denomination buttons */}
            <div className="flex gap-2 flex-wrap">
              {denominations.map((d) => (
                <button
                  key={d}
                  onClick={() => { setCashInput(String(d)); setError('') }}
                  className="px-3 py-1 border rounded-full text-sm hover:bg-blue-50 hover:border-blue-400 transition-colors"
                >
                  Rp {d.toLocaleString('id-ID')}
                </button>
              ))}
            </div>

            {cashAmount >= total && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Kembalian</p>
                <p className="text-xl font-bold text-green-700">
                  Rp {(cashAmount - total).toLocaleString('id-ID')}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => setStep('method')} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Kembali</button>
              <button
                onClick={handleCashConfirm}
                disabled={cashAmount < total}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        )}

        {/* Step: QRIS payment */}
        {step === 'qris' && (
          <div className="p-4 flex flex-col gap-3 items-center">
            {qrisImageUrl ? (
              <img src={qrisImageUrl} alt="QRIS QR Code" className="w-52 h-52 object-contain border rounded-xl" />
            ) : (
              <div className="w-52 h-52 border-2 border-dashed rounded-xl flex items-center justify-center text-gray-400 text-sm text-center p-4">
                QR Code belum dikonfigurasi. Upload di halaman Pengaturan.
              </div>
            )}
            <p className="text-sm text-gray-600 text-center">
              Minta pelanggan memindai QR code di atas, lalu konfirmasi setelah pembayaran berhasil.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 w-full">
              <button onClick={() => setStep('method')} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Kembali</button>
              <button
                onClick={() => onConfirm({ method: 'QRIS', cashReceived: total, change: 0 })}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Pembayaran Diterima
              </button>
            </div>
          </div>
        )}

        {/* Step: split payment */}
        {step === 'split' && (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-sm text-gray-600 font-medium">Masukkan jumlah untuk masing-masing metode</p>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Tunai Rp</span>
                <input
                  type="number"
                  min="0"
                  value={splitCash}
                  onChange={(e) => { setSplitCash(e.target.value); setSplitQris(String(Math.max(0, total - (parseInt(e.target.value, 10) || 0)))); setError('') }}
                  className="w-full pl-24 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Jumlah tunai"
                  autoFocus
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">QRIS Rp</span>
                <input
                  type="number"
                  min="0"
                  value={splitQris}
                  onChange={(e) => { setSplitQris(e.target.value); setSplitCash(String(Math.max(0, total - (parseInt(e.target.value, 10) || 0)))); setError('') }}
                  className="w-full pl-24 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Jumlah QRIS"
                />
              </div>
            </div>
            {splitCashAmount + splitQrisAmount === total && (
              <p className="text-xs text-green-600 font-medium">✓ Total cocok: Rp {total.toLocaleString('id-ID')}</p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep('method')} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Kembali</button>
              <button
                onClick={handleSplitConfirm}
                disabled={splitCashAmount + splitQrisAmount !== total}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
