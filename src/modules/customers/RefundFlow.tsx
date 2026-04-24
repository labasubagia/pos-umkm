/**
 * RefundFlow.tsx — UI for processing refunds on completed transactions.
 *
 * Allows the owner/manager to:
 *   1. Look up a transaction by ID.
 *   2. Select which items (and how many) are being returned.
 *   3. Provide a reason and submit the refund.
 *
 * Stock is automatically re-incremented by refund.service.createRefund().
 */

import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatIDR } from "../../lib/formatters";
import { generateId } from "../../lib/uuid";
import type { Transaction } from "../cashier/cashier.service";
import {
  createRefund,
  fetchTransaction,
  RefundError,
  type RefundItem,
} from "./refund.service";

interface ItemEntry {
  product_id: string;
  product_name: string;
  unit_price: number;
  originalQty: number;
  refundQty: number;
}

export function RefundFlow() {
  const [txIdInput, setTxIdInput] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<(ItemEntry & { _uid: string })[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFind() {
    setFindError(null);
    setTransaction(null);
    setItems([]);
    setSuccess(false);
    setLoading(true);
    try {
      const tx = await fetchTransaction(txIdInput.trim());
      setTransaction(tx);
      // For MVP, we don't load line items from Transaction_Items — user inputs qty manually
      setItems([]);
    } catch (err) {
      setFindError(
        err instanceof RefundError ? err.message : "Transaksi tidak ditemukan",
      );
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        product_id: "",
        product_name: "",
        unit_price: 0,
        originalQty: 1,
        refundQty: 1,
        _uid: generateId(),
      },
    ]);
  }

  function updateItem(
    index: number,
    field: keyof ItemEntry,
    value: string | number,
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!transaction) return;
    if (items.length === 0) {
      setSubmitError("Pilih minimal satu item untuk direfund");
      return;
    }
    if (!reason.trim()) {
      setSubmitError("Alasan refund wajib diisi");
      return;
    }

    const refundItems: RefundItem[] = items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      qty: item.refundQty,
      unit_price: item.unit_price,
    }));

    setLoading(true);
    try {
      await createRefund(transaction.id, refundItems, reason.trim());
      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof RefundError ? err.message : "Gagal memproses refund",
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-6 text-center"
        data-testid="refund-success"
      >
        <p className="text-lg font-semibold text-green-700">
          ✓ Refund berhasil diproses
        </p>
        <p className="mt-1 text-sm text-green-600">Stok telah dikembalikan.</p>
        <Button
          type="button"
          className="mt-4 bg-green-600 hover:bg-green-700"
          onClick={() => {
            setSuccess(false);
            setTransaction(null);
            setTxIdInput("");
            setItems([]);
            setReason("");
          }}
        >
          Refund Lainnya
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transaction lookup */}
      <div className="space-y-2">
        <Label>ID Transaksi</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Masukkan ID transaksi atau nomor struk..."
            value={txIdInput}
            onChange={(e) => setTxIdInput(e.target.value)}
            data-testid="refund-tx-id-input"
          />
          <Button
            type="button"
            onClick={handleFind}
            disabled={loading || !txIdInput.trim()}
            data-testid="btn-find-transaction"
          >
            Cari
          </Button>
        </div>
        {findError && (
          <Alert variant="destructive" data-testid="refund-error">
            <AlertDescription>{findError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Transaction info */}
      {transaction && (
        <Card data-testid="refund-tx-info">
          <CardContent className="pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">No. Struk</dt>
              <dd className="font-medium">{transaction.receipt_number}</dd>
              <dt className="text-gray-500">Total</dt>
              <dd className="font-medium">{formatIDR(transaction.total)}</dd>
              <dt className="text-gray-500">Tanggal</dt>
              <dd>
                {new Date(transaction.created_at).toLocaleDateString("id-ID")}
              </dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Item entries */}
      {transaction && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Item yang Dikembalikan
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              data-testid="btn-add-refund-item"
            >
              + Tambah Item
            </Button>
          </div>

          {items.map((item, index) => (
            <div
              key={item._uid}
              className="grid grid-cols-12 gap-2 rounded border border-gray-200 p-3 text-sm"
              data-testid={`refund-item-row-${index}`}
            >
              <Input
                className="col-span-4"
                placeholder="Nama produk"
                value={item.product_name}
                onChange={(e) =>
                  updateItem(index, "product_name", e.target.value)
                }
                data-testid={`refund-item-name-${index}`}
              />
              <Input
                className="col-span-2"
                placeholder="ID produk"
                value={item.product_id}
                onChange={(e) =>
                  updateItem(index, "product_id", e.target.value)
                }
                data-testid={`refund-item-product-id-${index}`}
              />
              <Input
                className="col-span-2"
                type="number"
                placeholder="Harga"
                value={item.unit_price || ""}
                onChange={(e) =>
                  updateItem(index, "unit_price", Number(e.target.value))
                }
                data-testid={`refund-item-price-${index}`}
              />
              <Input
                className="col-span-2"
                type="number"
                min={1}
                placeholder="Qty"
                value={item.refundQty}
                onChange={(e) =>
                  updateItem(index, "refundQty", Number(e.target.value))
                }
                data-testid={`refund-item-qty-${index}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => removeItem(index)}
                data-testid={`btn-remove-refund-item-${index}`}
              >
                Hapus
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Reason */}
      {transaction && (
        <div className="space-y-2">
          <Label>Alasan Pengembalian</Label>
          <Input
            type="text"
            placeholder="Contoh: Produk rusak, salah pesanan..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="refund-reason-input"
          />
        </div>
      )}

      {/* Submit */}
      {transaction && (
        <div>
          {submitError && (
            <Alert
              variant="destructive"
              className="mb-2"
              data-testid="refund-error"
            >
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            className="w-full bg-red-600 hover:bg-red-700"
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            data-testid="btn-submit-refund"
          >
            {loading ? "Memproses..." : "Proses Refund"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default RefundFlow;
