import { useState, useEffect } from 'react'
import { fetchDailySummary, type DailySummary as DailySummaryType, ReportError } from './reports.service'
import { formatIDR } from '../../lib/formatters'

export function DailySummary() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [summary, setSummary] = useState<DailySummaryType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(d: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDailySummary(d)
      setSummary(result)
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

  useEffect(() => {
    load(today)
  }, [])

  return (
    <div data-testid="daily-summary-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Ringkasan Harian</h2>
      <div className="flex gap-2 items-center">
        <input
          data-testid="input-summary-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          data-testid="btn-load-summary"
          onClick={() => load(date)}
          disabled={loading}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Lihat Laporan
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Total Pendapatan</p>
              <p data-testid="summary-revenue" className="text-lg font-bold">
                {formatIDR(summary.total_revenue)}
              </p>
            </div>
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Jumlah Transaksi</p>
              <p data-testid="summary-tx-count" className="text-lg font-bold">
                {summary.transaction_count}
              </p>
            </div>
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Rata-rata Belanja</p>
              <p data-testid="summary-avg-basket" className="text-lg font-bold">
                {formatIDR(Math.round(summary.average_basket))}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Produk Terlaris</h3>
            <table data-testid="top-products-table" className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left">Produk</th>
                  <th className="border px-3 py-2 text-right">Qty</th>
                  <th className="border px-3 py-2 text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="border px-3 py-2">{p.name}</td>
                    <td className="border px-3 py-2 text-right">{p.total_qty}</td>
                    <td className="border px-3 py-2 text-right">{formatIDR(p.total_revenue)}</td>
                  </tr>
                ))}
                {summary.top_products.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border px-3 py-2 text-center text-gray-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
