import { useState, useEffect, useRef } from 'react'
import { fetchDailySummary, type DailySummary as DailySummaryType, ReportError } from './reports.service'
import { formatIDR } from '../../lib/formatters'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Card, CardContent } from '../../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'

export function DailySummary() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [summary, setSummary] = useState<DailySummaryType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

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
    if (initialized.current) return
    initialized.current = true
    load(today)
  }, [])

  return (
    <div data-testid="daily-summary-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Ringkasan Harian</h2>
      <div className="flex gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Tanggal</Label>
          <Input
            data-testid="input-summary-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button
          data-testid="btn-load-summary"
          onClick={() => load(date)}
          disabled={loading}
        >
          Lihat Laporan
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Total Pendapatan</p>
                <p data-testid="summary-revenue" className="text-lg font-bold">
                  {formatIDR(summary.total_revenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Jumlah Transaksi</p>
                <p data-testid="summary-tx-count" className="text-lg font-bold">
                  {summary.transaction_count}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Rata-rata Belanja</p>
                <p data-testid="summary-avg-basket" className="text-lg font-bold">
                  {formatIDR(Math.round(summary.average_basket))}
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Produk Terlaris</h3>
            <Table data-testid="top-products-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.top_products.map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.total_qty}</TableCell>
                    <TableCell className="text-right">{formatIDR(p.total_revenue)}</TableCell>
                  </TableRow>
                ))}
                {summary.top_products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
