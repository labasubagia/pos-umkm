/**
 * PaymentModal.tsx — Full payment flow modal (T027, T028, T030).
 *
 * Steps:
 *   1. Method selection (CASH / QRIS / SPLIT)
 *   2. Method-specific input (cash amount, QRIS image, or split amounts)
 *   3. Confirm → calls onConfirm with payment info
 *
 * The parent (CashierPage) is responsible for calling commitTransaction.
 */
import { useState } from "react";
import {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateTotal,
  calculateChange,
  suggestDenominations,
  validateSplitPayment,
  SplitPaymentError,
} from "./cashier.service";
import { useCartStore } from "./useCart";
import type { PaymentInfo } from "./cashier.service";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

interface Props {
  qrisImageUrl: string;
  taxRate: number;
  onConfirm: (payment: PaymentInfo) => void;
  onClose: () => void;
  loading?: boolean;
}

type Step = "method" | "cash" | "qris" | "split";

export function PaymentModal({
  qrisImageUrl,
  taxRate,
  onConfirm,
  onClose,
  loading = false,
}: Props) {
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);

  const subtotal = calculateSubtotal(items);
  const discountAmount = discount
    ? (() => {
        try {
          return applyDiscount(subtotal, discount);
        } catch {
          return 0;
        }
      })()
    : 0;
  const tax = calculateTax(subtotal - discountAmount, taxRate);
  const total = calculateTotal(subtotal, discountAmount, tax);

  const [step, setStep] = useState<Step>("method");
  const [cashInput, setCashInput] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [splitQris, setSplitQris] = useState("");
  const [error, setError] = useState("");

  const cashAmount = parseInt(cashInput, 10) || 0;
  const splitCashAmount = parseInt(splitCash, 10) || 0;
  const splitQrisAmount = parseInt(splitQris, 10) || 0;

  function handleCashConfirm() {
    try {
      const change = calculateChange(total, cashAmount);
      onConfirm({ method: "CASH", cashReceived: cashAmount, change });
    } catch {
      setError(
        "Uang diterima kurang dari total. Harap masukkan jumlah yang cukup.",
      );
    }
  }

  function handleSplitConfirm() {
    try {
      validateSplitPayment(splitCashAmount, splitQrisAmount, total);
      onConfirm({
        method: "SPLIT",
        cashReceived: splitCashAmount + splitQrisAmount,
        change: 0,
        splitCash: splitCashAmount,
        splitQris: splitQrisAmount,
      });
    } catch (e) {
      if (e instanceof SplitPaymentError) {
        setError(e.message);
      } else {
        setError("Terjadi kesalahan saat validasi pembayaran split");
      }
    }
  }

  const denominations = suggestDenominations(total);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        data-testid="payment-modal"
      >
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>

        {/* Total display */}
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">Total Pembayaran</p>
          <p className="text-3xl font-bold text-blue-700">
            Rp {total.toLocaleString("id-ID")}
          </p>
          {discountAmount > 0 && (
            <p className="text-xs text-green-600 mt-1">
              Termasuk diskon Rp {discountAmount.toLocaleString("id-ID")}
            </p>
          )}
          {tax > 0 && (
            <p className="text-xs text-gray-400">
              PPN {taxRate}%: Rp {tax.toLocaleString("id-ID")}
            </p>
          )}
        </div>

        {/* Step: method selection */}
        {step === "method" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 font-medium">
              Pilih Metode Pembayaran
            </p>
            <button
              onClick={() => setStep("cash")}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
              data-testid="btn-method-cash"
            >
              <p className="font-semibold">💵 Tunai</p>
              <p className="text-xs text-gray-400">Hitung kembalian otomatis</p>
            </button>
            <button
              onClick={() => setStep("qris")}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
              data-testid="btn-method-qris"
            >
              <p className="font-semibold">📱 QRIS</p>
              <p className="text-xs text-gray-400">
                Tampilkan QR code ke pelanggan
              </p>
            </button>
            <button
              onClick={() => setStep("split")}
              className="p-4 border-2 rounded-xl text-left hover:border-blue-500 transition-colors"
              data-testid="btn-method-split"
            >
              <p className="font-semibold">✂️ Split (Tunai + QRIS)</p>
              <p className="text-xs text-gray-400">
                Sebagian tunai, sebagian QRIS
              </p>
            </button>
          </div>
        )}

        {/* Step: cash payment */}
        {step === "cash" && (
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label>Uang Diterima</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  Rp
                </span>
                <Input
                  type="number"
                  min={total}
                  value={cashInput}
                  onChange={(e) => {
                    setCashInput(e.target.value);
                    setError("");
                  }}
                  placeholder={String(total)}
                  className="pl-10"
                  aria-label="Uang diterima"
                  data-testid="input-cash"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick denomination buttons */}
            <div className="flex gap-2 flex-wrap">
              {denominations.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setCashInput(String(d));
                    setError("");
                  }}
                  className="px-3 py-1 border rounded-full text-sm hover:bg-blue-50 hover:border-blue-400 transition-colors"
                  data-testid={`btn-denomination-${d}`}
                >
                  Rp {d.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            {cashAmount >= total && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Kembalian</p>
                <p
                  className="text-xl font-bold text-green-700"
                  data-testid="change-amount"
                >
                  Rp {(cashAmount - total).toLocaleString("id-ID")}
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("method")}
                className="flex-1"
                disabled={loading}
              >
                Kembali
              </Button>
              <Button
                onClick={handleCashConfirm}
                disabled={cashAmount < total || loading}
                className="flex-1"
                data-testid="btn-cash-confirm"
              >
                {loading ? "Memproses…" : "Konfirmasi"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: QRIS payment */}
        {step === "qris" && (
          <div className="flex flex-col gap-3 items-center">
            {qrisImageUrl ? (
              <img
                src={qrisImageUrl}
                alt="QRIS QR Code"
                className="w-52 h-52 object-contain border rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 border-2 border-dashed rounded-xl flex items-center justify-center text-gray-400 text-sm text-center p-4">
                QR Code belum dikonfigurasi. Upload di halaman Pengaturan.
              </div>
            )}
            <p className="text-sm text-gray-600 text-center">
              Minta pelanggan memindai QR code di atas, lalu konfirmasi setelah
              pembayaran berhasil.
            </p>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setStep("method")}
                className="flex-1"
                disabled={loading}
              >
                Kembali
              </Button>
              <Button
                onClick={() =>
                  onConfirm({ method: "QRIS", cashReceived: total, change: 0 })
                }
                className="flex-1"
                disabled={loading}
                data-testid="btn-qris-confirm"
              >
                {loading ? "Memproses…" : "Pembayaran Diterima"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: split payment */}
        {step === "split" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 font-medium">
              Masukkan jumlah untuk masing-masing metode
            </p>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  Tunai Rp
                </span>
                <Input
                  type="number"
                  min="0"
                  value={splitCash}
                  onChange={(e) => {
                    setSplitCash(e.target.value);
                    setSplitQris(
                      String(
                        Math.max(
                          0,
                          total - (parseInt(e.target.value, 10) || 0),
                        ),
                      ),
                    );
                    setError("");
                  }}
                  className="pl-24"
                  aria-label="Jumlah tunai"
                  data-testid="input-split-cash"
                  autoFocus
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  QRIS Rp
                </span>
                <Input
                  type="number"
                  min="0"
                  value={splitQris}
                  onChange={(e) => {
                    setSplitQris(e.target.value);
                    setSplitCash(
                      String(
                        Math.max(
                          0,
                          total - (parseInt(e.target.value, 10) || 0),
                        ),
                      ),
                    );
                    setError("");
                  }}
                  className="pl-24"
                  aria-label="Jumlah QRIS"
                  data-testid="input-split-qris"
                />
              </div>
            </div>
            {splitCashAmount + splitQrisAmount === total && (
              <p className="text-xs text-green-600 font-medium">
                ✓ Total cocok: Rp {total.toLocaleString("id-ID")}
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("method")}
                className="flex-1"
                disabled={loading}
              >
                Kembali
              </Button>
              <Button
                onClick={handleSplitConfirm}
                disabled={
                  splitCashAmount + splitQrisAmount !== total || loading
                }
                className="flex-1"
                data-testid="btn-split-confirm"
              >
                {loading ? "Memproses…" : "Konfirmasi"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
