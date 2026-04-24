/**
 * DailySummary.tsx — Daily sales summary report.
 *
 * Uses React Query with enabled:false — fetches only when user clicks
 * "Lihat Laporan". Query key includes date so clicking with a new date
 * triggers a fresh fetch.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
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
import { formatIDR } from "../../lib/formatters";
import { useAuthStore } from "../../store/authStore";
import { fetchDailySummary, ReportError } from "./reports.service";

export function DailySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [enabled, setEnabled] = useState(true); // fetch on mount with today's date
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const user = useAuthStore((s) => s.user);
  const monthlySpreadsheetId = useAuthStore((s) => s.monthlySpreadsheetId);
  const spreadsheetId = useAuthStore((s) => s.spreadsheetId);
  const isOwner = user?.role === "owner";
  const txSheetId = monthlySpreadsheetId ?? spreadsheetId;

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["daily-summary", activeStoreId, date],
    queryFn: () => fetchDailySummary(date),
    enabled,
    retry: false,
  });

  function handleLoad() {
    setEnabled(true);
    void refetch();
  }

  const errorMsg =
    error instanceof ReportError
      ? error.message
      : error instanceof Error
        ? "Terjadi kesalahan saat memuat laporan"
        : null;

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
            onChange={(e) => {
              setDate(e.target.value);
              setEnabled(false);
            }}
            className="w-auto"
          />
        </div>
        <Button
          data-testid="btn-load-summary"
          onClick={handleLoad}
          disabled={isLoading}
        >
          Lihat Laporan
        </Button>
      </div>

      {isOwner && txSheetId && (
        <div className="no-print">
          <a
            data-testid="link-transaction-sheet"
            href={`https://docs.google.com/spreadsheets/d/${txSheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Buka Spreadsheet Transaksi
          </a>
        </div>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
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
                <p
                  data-testid="summary-avg-basket"
                  className="text-lg font-bold"
                >
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
                    <TableCell className="text-right">
                      {formatIDR(p.total_revenue)}
                    </TableCell>
                  </TableRow>
                ))}
                {summary.top_products.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-gray-400"
                    >
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
  );
}
