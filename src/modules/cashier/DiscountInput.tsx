/**
 * DiscountInput.tsx — Discount type/amount input for the cashier screen (T029).
 *
 * Lets the owner toggle between flat IDR and percentage discount.
 * Updates the cart discount in useCartStore on change.
 */
import { useState } from 'react'
import { useCartStore } from './useCart'
import type { DiscountType } from './cashier.service'

export function DiscountInput() {
  const [type, setType] = useState<'flat' | 'percent'>('flat')
  const [value, setValue] = useState('')
  const setDiscount = useCartStore((s) => s.setDiscount)
  const discount = useCartStore((s) => s.discount)

  function handleApply() {
    const num = parseInt(value, 10)
    if (!value || isNaN(num) || num <= 0) {
      setDiscount(null)
      return
    }
    const d: DiscountType = { type, value: num }
    setDiscount(d)
  }

  function handleClear() {
    setValue('')
    setDiscount(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Diskon</label>

      {/* Type toggle */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button
          onClick={() => setType('flat')}
          className={`flex-1 py-1.5 transition-colors ${type === 'flat' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          aria-pressed={type === 'flat'}
        >
          Nominal (Rp)
        </button>
        <button
          onClick={() => setType('percent')}
          className={`flex-1 py-1.5 transition-colors ${type === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          aria-pressed={type === 'percent'}
        >
          Persen (%)
        </button>
      </div>

      {/* Amount input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {type === 'flat' ? 'Rp' : '%'}
          </span>
          <input
            type="number"
            min="1"
            max={type === 'percent' ? '100' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'flat' ? '5000' : '10'}
            className="w-full pl-10 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Nilai diskon"
          />
        </div>
        <button
          onClick={handleApply}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Terapkan
        </button>
        {discount && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-50"
          >
            Hapus
          </button>
        )}
      </div>

      {discount && (
        <p className="text-xs text-green-600 font-medium">
          Diskon aktif:{' '}
          {discount.type === 'percent' ? `${discount.value}%` : `Rp ${discount.value.toLocaleString('id-ID')}`}
        </p>
      )}
    </div>
  )
}
