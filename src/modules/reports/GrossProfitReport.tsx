import { useState } from "react";
import { getRepos } from "../../api/adapters";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatIDR } from "../../utils/formatters";
import {
  calculateGrossProfit,
  fetchTransactionsForRange,
  getCurrentMonthDateBounds,
  isMonthlyPartitionedStore,
  type ProfitSummary,
  ReportError,
} from "./reports.service";

export function GrossProfitReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [result, setResult] = useState<ProfitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const monthlyPartitioned = isMonthlyPartitionedStore();
  const monthBounds = getCurrentMonthDateBounds();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [transactions, itemRows, productRows] = await Promise.all([
        fetchTransactionsForRange(startDate, endDate),
        getRepos().transactionItems.getAll(),
        getRepos().products.getAll(),
      ]);

      const items = itemRows.map((r) => ({
        id: String(r.id),
        transaction_id: String(r.transaction_id),
        product_id: String(r.product_id),
        name: String(r.name),
        price: Number(r.price),
        quantity: Number(r.quantity),
        subtotal: Number(r.subtotal),
      }));

      const products = productRows.map((r) => ({
        id: String(r.id),
        cost_price: Number(r.cost_price ?? 0),
      }));

      setResult(calculateGrossProfit(transactions, items, products));
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan saat memuat laporan");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="profit-report-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Laporan Laba Kotor</h2>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Dari</Label>
          <Input
            type="date"
            value={startDate}
            min={monthlyPartitioned ? monthBounds.start : undefined}
            max={monthlyPartitioned ? monthBounds.end : undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <span className="self-end pb-2 text-sm">s/d</span>
        <div className="space-y-1.5">
          <Label>Sampai</Label>
          <Input
            type="date"
            value={endDate}
            min={monthlyPartitioned ? monthBounds.start : undefined}
            max={monthlyPartitioned ? monthBounds.end : undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button data-testid="btn-load-profit" onClick={load} disabled={loading}>
          Lihat Laporan
        </Button>
      </div>

      {monthlyPartitioned && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="report-monthly-note"
        >
          Toko ini memakai partisi transaksi bulanan. Rentang laporan dibatasi
          ke bulan berjalan.
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Total Pendapatan</p>
              <p
                data-testid="profit-total-revenue"
                className="text-lg font-bold"
              >
                {formatIDR(result.total_revenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Total Biaya</p>
              <p data-testid="profit-total-cost" className="text-lg font-bold">
                {formatIDR(result.total_cost)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Laba Kotor</p>
              <p data-testid="profit-gross" className="text-lg font-bold">
                {formatIDR(result.gross_profit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Margin</p>
              <p data-testid="profit-margin" className="text-lg font-bold">
                {result.margin_percent}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
