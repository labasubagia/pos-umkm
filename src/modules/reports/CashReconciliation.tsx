import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatIDR } from "../../lib/formatters";
import {
  calculateExpectedCash,
  fetchTransactionsForRange,
  ReportError,
  saveReconciliation,
} from "./reports.service";

export function CashReconciliation() {
  const today = new Date().toISOString().slice(0, 10);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [date, setDate] = useState(today);
  const [expected, setExpected] = useState<number | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const transactions = await fetchTransactionsForRange(date, date);
      const dayTxs = transactions.filter((t) => t.created_at.startsWith(date));
      const exp = calculateExpectedCash(
        Number(openingBalance) || 0,
        dayTxs,
        [],
      );
      const act = Number(closingBalance) || 0;
      setExpected(exp);
      setActual(act);
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan");
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (expected === null || actual === null) return;
    setError(null);
    try {
      await saveReconciliation(expected, actual, date);
      setSaved(true);
    } catch (err) {
      if (err instanceof ReportError) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan saat menyimpan");
      }
    }
  }

  const diff = expected !== null && actual !== null ? actual - expected : null;

  return (
    <div data-testid="reconciliation-container" className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Rekonsiliasi Kas</h2>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Tanggal</Label>
          <Input
            data-testid="input-reconciliation-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Saldo Awal (Rp)</Label>
          <Input
            data-testid="input-opening-balance"
            type="number"
            placeholder="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Saldo Penutup (Rp)</Label>
          <Input
            data-testid="input-closing-balance"
            type="number"
            placeholder="0"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          data-testid="btn-calculate-reconciliation"
          onClick={calculate}
          disabled={loading}
        >
          Hitung Rekonsiliasi
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {expected !== null && actual !== null && diff !== null && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Kas Diharapkan</p>
                <p
                  data-testid="reconciliation-expected"
                  className="text-lg font-bold"
                >
                  {formatIDR(expected)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Kas Aktual</p>
                <p
                  data-testid="reconciliation-actual"
                  className="text-lg font-bold"
                >
                  {formatIDR(actual)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Selisih</p>
                <p
                  data-testid="reconciliation-diff"
                  className={`text-lg font-bold ${diff >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {diff >= 0 ? "+" : ""}
                  {formatIDR(Math.abs(diff))}
                  {diff >= 0 ? " (Surplus)" : " (Defisit)"}
                </p>
              </CardContent>
            </Card>
          </div>

          {!saved && (
            <Button
              data-testid="btn-save-reconciliation"
              onClick={save}
              className="bg-green-600 hover:bg-green-700"
            >
              Simpan
            </Button>
          )}
          {saved && (
            <Alert className="border-green-500 bg-green-50 text-green-800">
              <AlertDescription>
                Rekonsiliasi berhasil disimpan.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
