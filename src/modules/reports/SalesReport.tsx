import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatDateTimeTZ, formatIDR } from "../../lib/formatters";
import { useAuthStore } from "../../store/authStore";
import { listMembers } from "../settings/members.service";
import { printReport } from "./export.service";
import {
  fetchTransactionsForRange,
  filterTransactions,
  ReportError,
  type ReportFilters,
  type TransactionRow,
} from "./reports.service";

export function SalesReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [cashierEmail, setCashierEmail] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<
    "" | "CASH" | "QRIS" | "SPLIT"
  >("");
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [cashierEmailMap, setCashierEmailMap] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const monthlySpreadsheetId = useAuthStore((s) => s.monthlySpreadsheetId);
  const spreadsheetId = useAuthStore((s) => s.spreadsheetId);
  const isOwner = user?.role === "owner";
  const txSheetId = monthlySpreadsheetId ?? spreadsheetId;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Build google_user_id → email map: logged-in user first, then Members sheet.
      const authUser = useAuthStore.getState().user;
      const emailMap: Record<string, string> = {};
      if (authUser?.id && authUser?.email)
        emailMap[authUser.id] = authUser.email;
      const members = await listMembers();
      for (const m of members) {
        if (m.google_user_id && m.email) emailMap[m.google_user_id] = m.email;
      }
      setCashierEmailMap(emailMap);

      const all = await fetchTransactionsForRange(startDate, endDate);
      const filters: ReportFilters = {};
      if (cashierEmail.trim()) filters.cashier_email = cashierEmail.trim();
      if (paymentFilter) filters.payment_method = paymentFilter;
      const filtered = filterTransactions(all, filters);
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRows(filtered);
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

  const totalRevenue = rows ? rows.reduce((s, r) => s + r.total, 0) : 0;

  function resolveCashier(cashierId: string): string {
    return cashierEmailMap[cashierId] ?? cashierId;
  }

  return (
    <div data-testid="sales-report-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Laporan Penjualan</h2>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Dari</Label>
          <Input
            data-testid="input-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <span className="self-end pb-2 text-sm">s/d</span>
        <div className="space-y-1.5">
          <Label>Sampai</Label>
          <Input
            data-testid="input-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email Kasir</Label>
          <Input
            placeholder="Email kasir"
            value={cashierEmail}
            onChange={(e) => setCashierEmail(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Metode Bayar</Label>
          <select
            data-testid="select-payment-filter"
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as "" | "CASH" | "QRIS" | "SPLIT")
            }
            className="rounded-lg border border-input bg-transparent px-2 py-2 text-sm"
          >
            <option value="">Semua Pembayaran</option>
            <option value="CASH">CASH</option>
            <option value="QRIS">QRIS</option>
            <option value="SPLIT">SPLIT</option>
          </select>
        </div>
        <Button data-testid="btn-load-report" onClick={load} disabled={loading}>
          Lihat Laporan
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows !== null && (
        <div className="space-y-2">
          <div className="flex gap-2 no-print">
            <Button
              variant="secondary"
              data-testid="btn-print-report"
              onClick={printReport}
              className="bg-gray-600 text-white hover:bg-gray-700"
            >
              Cetak
            </Button>
            {isOwner && txSheetId && (
              <a
                data-testid="link-transaction-sheet"
                href={`https://docs.google.com/spreadsheets/d/${txSheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline self-center"
              >
                Buka Spreadsheet Transaksi
              </a>
            )}
          </div>

          <Table data-testid="report-results-table">
            <TableHeader>
              <TableRow>
                <TableHead>No. Struk</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Pembayaran</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.receipt_number}</TableCell>
                  <TableCell>{formatDateTimeTZ(r.created_at)}</TableCell>
                  <TableCell>{resolveCashier(r.cashier_id)}</TableCell>
                  <TableCell>{r.payment_method}</TableCell>
                  <TableCell className="text-right">
                    {formatIDR(r.total)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400">
                    Tidak ada transaksi
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <tfoot>
              <TableRow className="font-semibold bg-muted/50">
                <TableCell colSpan={4} className="text-right">
                  Total Pendapatan
                </TableCell>
                <TableCell
                  data-testid="report-total-revenue"
                  className="text-right"
                >
                  {formatIDR(totalRevenue)}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
