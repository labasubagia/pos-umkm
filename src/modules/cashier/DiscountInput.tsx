/**
 * DiscountInput.tsx — Discount type/amount input for the cashier screen (T029).
 *
 * Lets the owner toggle between flat IDR and percentage discount.
 * Updates the cart discount in useCartStore on change.
 */
import { useState } from "react";
import { useCartStore } from "./useCart";
import type { DiscountType } from "./cashier.service";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export function DiscountInput() {
  const [type, setType] = useState<"flat" | "percent">("flat");
  const [value, setValue] = useState("");
  const setDiscount = useCartStore((s) => s.setDiscount);
  const discount = useCartStore((s) => s.discount);

  function handleApply() {
    const num = parseInt(value, 10);
    if (!value || isNaN(num) || num <= 0) {
      setDiscount(null);
      return;
    }
    const d: DiscountType = { type, value: num };
    setDiscount(d);
  }

  function handleClear() {
    setValue("");
    setDiscount(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-gray-700">Diskon</Label>

      {/* Type toggle */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button
          onClick={() => setType("flat")}
          className={`flex-1 py-1.5 transition-colors ${type === "flat" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          aria-pressed={type === "flat"}
          data-testid="btn-discount-flat"
        >
          Nominal (Rp)
        </button>
        <button
          onClick={() => setType("percent")}
          className={`flex-1 py-1.5 transition-colors ${type === "percent" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          aria-pressed={type === "percent"}
          data-testid="btn-discount-percent"
        >
          Persen (%)
        </button>
      </div>

      {/* Amount input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {type === "flat" ? "Rp" : "%"}
          </span>
          <Input
            type="number"
            min="1"
            max={type === "percent" ? "100" : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "flat" ? "5000" : "10"}
            className="pl-10"
            aria-label="Nilai diskon"
            data-testid="input-discount-value"
          />
        </div>
        <Button
          size="sm"
          onClick={handleApply}
          data-testid="btn-discount-apply"
        >
          Terapkan
        </Button>
        {discount && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Hapus
          </Button>
        )}
      </div>

      {discount && (
        <p className="text-xs text-green-600 font-medium">
          Diskon aktif:{" "}
          {discount.type === "percent"
            ? `${discount.value}%`
            : `Rp ${discount.value.toLocaleString("id-ID")}`}
        </p>
      )}
    </div>
  );
}
