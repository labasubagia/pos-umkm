import { useState } from 'react'
import {
  fetchTransactionsForRange,
  calculateGrossProfit,
  type ProfitSummary,
  ReportError,
} from './reports.service'
import { dataAdapter } from '../../lib/adapters'
import { formatIDR } from '../../lib/formatters'

export function GrossProfitReport() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [result, setResult] = useState<ProfitSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [transactions, itemRows, productRows] = await Promise.all([
        fetchTransactionsForRange(startDate, endDate),
        dataAdapter.getSheet('Transaction_Items'),
        dataAdapter.getSheet('Products'),
      ])

      const items = itemRows.map((r) => ({
        id: String(r['id']),
        transaction_id: String(r['transaction_id']),
        product_id: String(r['product_id']),
        name: String(r['name']),
        price: Number(r['price']),
        quantity: Number(r['quantity']),
        subtotal: Number(r['subtotal']),
      }))

      const products = productRows.map((r) => ({
        id: String(r['id']),
        cost_price: Number(r['cost_price'] ?? 0),
      }))

      setResult(calculateGrossProfit(transactions, items, products))
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message)
      } else {
        setError('Terjadi kesalahan saat memuat laporan')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="profit-report-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Laporan Laba Kotor</h2>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <span>s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          data-testid="btn-load-profit"
          onClick={load}
          disabled={loading}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Lihat Laporan
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <p className="text-sm text-gray-500">Total Pendapatan</p>
            <p data-testid="profit-total-revenue" className="text-lg font-bold">
              {formatIDR(result.total_revenue)}
            </p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-500">Total Biaya</p>
            <p data-testid="profit-total-cost" className="text-lg font-bold">
              {formatIDR(result.total_cost)}
            </p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-500">Laba Kotor</p>
            <p data-testid="profit-gross" className="text-lg font-bold">
              {formatIDR(result.gross_profit)}
            </p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-500">Margin</p>
            <p data-testid="profit-margin" className="text-lg font-bold">
              {result.margin_percent}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
