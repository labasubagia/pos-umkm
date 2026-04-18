import { useState } from 'react'
import {
  fetchTransactionsForRange,
  calculateExpectedCash,
  saveReconciliation,
  ReportError,
} from './reports.service'
import { formatIDR } from '../../lib/formatters'

export function CashReconciliation() {
  const today = new Date().toISOString().slice(0, 10)
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [date, setDate] = useState(today)
  const [expected, setExpected] = useState<number | null>(null)
  const [actual, setActual] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function calculate() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const transactions = await fetchTransactionsForRange(date, date)
      const dayTxs = transactions.filter((t) => t.created_at.startsWith(date))
      const exp = calculateExpectedCash(Number(openingBalance) || 0, dayTxs, [])
      const act = Number(closingBalance) || 0
      setExpected(exp)
      setActual(act)
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message)
      } else {
        setError('Terjadi kesalahan')
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (expected === null || actual === null) return
    setError(null)
    try {
      await saveReconciliation(expected, actual, date)
      setSaved(true)
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message)
      } else {
        setError('Terjadi kesalahan saat menyimpan')
      }
    }
  }

  const diff = expected !== null && actual !== null ? actual - expected : null

  return (
    <div data-testid="reconciliation-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Rekonsiliasi Kas</h2>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          data-testid="input-reconciliation-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <input
          data-testid="input-opening-balance"
          type="number"
          placeholder="Saldo awal (Rp)"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <input
          data-testid="input-closing-balance"
          type="number"
          placeholder="Saldo penutup (Rp)"
          value={closingBalance}
          onChange={(e) => setClosingBalance(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          data-testid="btn-calculate-reconciliation"
          onClick={calculate}
          disabled={loading}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Hitung Rekonsiliasi
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {expected !== null && actual !== null && diff !== null && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Kas Diharapkan</p>
              <p data-testid="reconciliation-expected" className="text-lg font-bold">
                {formatIDR(expected)}
              </p>
            </div>
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Kas Aktual</p>
              <p data-testid="reconciliation-actual" className="text-lg font-bold">
                {formatIDR(actual)}
              </p>
            </div>
            <div className="border rounded p-3">
              <p className="text-sm text-gray-500">Selisih</p>
              <p
                data-testid="reconciliation-diff"
                className={`text-lg font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {diff >= 0 ? '+' : ''}{formatIDR(Math.abs(diff))}
                {diff >= 0 ? ' (Surplus)' : ' (Defisit)'}
              </p>
            </div>
          </div>

          {!saved && (
            <button
              data-testid="btn-save-reconciliation"
              onClick={save}
              className="px-4 py-1 bg-green-600 text-white rounded"
            >
              Simpan
            </button>
          )}
          {saved && <p className="text-green-600 font-semibold">Rekonsiliasi berhasil disimpan.</p>}
        </div>
      )}
    </div>
  )
}
