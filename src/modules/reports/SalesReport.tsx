import { useState } from 'react'
import {
  fetchTransactionsForRange,
  filterTransactions,
  TransactionRow,
  ReportFilters,
  ReportError,
} from './reports.service'
import { formatIDR } from '../../lib/formatters'
import { exportToExcel, printReport } from './export.service'

export function SalesReport() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [cashierEmail, setCashierEmail] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'' | 'CASH' | 'QRIS' | 'SPLIT'>('')
  const [rows, setRows] = useState<TransactionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const all = await fetchTransactionsForRange(startDate, endDate)
      const filters: ReportFilters = {}
      if (cashierEmail.trim()) filters.cashier_email = cashierEmail.trim()
      if (paymentFilter) filters.payment_method = paymentFilter
      setRows(filterTransactions(all, filters))
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

  const totalRevenue = rows ? rows.reduce((s, r) => s + r.total, 0) : 0

  function handleExport() {
    if (!rows || rows.length === 0) return
    exportToExcel(
      rows.map((r) => ({
        ID: r.id,
        Tanggal: r.created_at,
        Kasir: r.cashier_id,
        Pembayaran: r.payment_method,
        Total: r.total,
      })),
      `laporan-penjualan-${startDate}-${endDate}`,
    )
  }

  return (
    <div data-testid="sales-report-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Laporan Penjualan</h2>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          data-testid="input-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <span>s/d</span>
        <input
          data-testid="input-end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <input
          placeholder="Email kasir"
          value={cashierEmail}
          onChange={(e) => setCashierEmail(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <select
          data-testid="select-payment-filter"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as '' | 'CASH' | 'QRIS' | 'SPLIT')}
          className="border rounded px-2 py-1"
        >
          <option value="">Semua Pembayaran</option>
          <option value="CASH">CASH</option>
          <option value="QRIS">QRIS</option>
          <option value="SPLIT">SPLIT</option>
        </select>
        <button
          data-testid="btn-load-report"
          onClick={load}
          disabled={loading}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Lihat Laporan
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {rows !== null && (
        <div className="space-y-2">
          <div className="flex gap-2 no-print">
            <button
              data-testid="btn-export-excel"
              onClick={handleExport}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Export Excel
            </button>
            <button
              data-testid="btn-print-report"
              onClick={printReport}
              className="px-3 py-1 bg-gray-600 text-white rounded"
            >
              Cetak
            </button>
          </div>

          <table data-testid="report-results-table" className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-3 py-2 text-left">ID</th>
                <th className="border px-3 py-2 text-left">Tanggal</th>
                <th className="border px-3 py-2 text-left">Kasir</th>
                <th className="border px-3 py-2 text-left">Pembayaran</th>
                <th className="border px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border px-3 py-2">{r.id}</td>
                  <td className="border px-3 py-2">{r.created_at}</td>
                  <td className="border px-3 py-2">{r.cashier_id}</td>
                  <td className="border px-3 py-2">{r.payment_method}</td>
                  <td className="border px-3 py-2 text-right">{formatIDR(r.total)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="border px-3 py-2 text-center text-gray-400">
                    Tidak ada transaksi
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-gray-50">
                <td colSpan={4} className="border px-3 py-2 text-right">Total Pendapatan</td>
                <td data-testid="report-total-revenue" className="border px-3 py-2 text-right">
                  {formatIDR(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
