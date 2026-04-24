/**
 * ProductForm.tsx — Form for creating and editing a product.
 * Accepts categories list to populate the category selector.
 */

import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { Category, NewProduct } from "./catalog.service";

interface Props {
  categories: Category[];
  initialProduct?: Partial<NewProduct>;
  onSubmit: (product: NewProduct) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ProductForm({
  categories,
  initialProduct = {},
  onSubmit,
  onCancel,
  submitLabel = "Simpan",
}: Props) {
  const [name, setName] = useState(initialProduct.name ?? "");
  const [sku, setSku] = useState(initialProduct.sku ?? "");
  const [price, setPrice] = useState(String(initialProduct.price ?? ""));
  const [stock, setStock] = useState(String(initialProduct.stock ?? "0"));
  const [categoryId, setCategoryId] = useState(
    initialProduct.category_id ?? "",
  );
  const [hasVariants, setHasVariants] = useState(
    initialProduct.has_variants ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama produk tidak boleh kosong");
      return;
    }
    const priceNum = parseInt(price, 10);
    if (
      !Number.isInteger(priceNum) ||
      priceNum <= 0 ||
      String(priceNum) !== price.trim()
    ) {
      setError("Harga harus bilangan bulat positif");
      return;
    }
    if (!categoryId) {
      setError("Pilih kategori terlebih dahulu");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        sku: sku.trim(),
        price: priceNum,
        stock: parseInt(stock, 10) || 0,
        category_id: categoryId,
        has_variants: hasVariants,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="product-name">Nama Produk</Label>
        <Input
          id="product-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Nasi Goreng Spesial"
          data-testid="input-product-name"
        />
      </div>

      {/* Keep native <select> — E2E tests use .selectOption() on this element */}
      <div className="flex flex-col gap-1">
        <label htmlFor="product-category" className="text-sm font-medium">
          Kategori
        </label>
        <select
          id="product-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
          data-testid="select-product-category"
        >
          <option value="">-- Pilih Kategori --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="product-price">Harga (Rp)</Label>
          <Input
            id="product-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={1}
            step={1}
            placeholder="15000"
            data-testid="input-product-price"
          />
        </div>

        <div className="flex-1 space-y-1.5">
          <Label htmlFor="product-stock">Stok</Label>
          <Input
            id="product-stock"
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            min={0}
            step={1}
            placeholder="0"
            data-testid="input-product-stock"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-sku">SKU (opsional)</Label>
        <Input
          id="product-sku"
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="NASGOR-01"
          maxLength={50}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="has-variants"
          checked={hasVariants}
          onCheckedChange={(checked) => setHasVariants(checked === true)}
        />
        <Label htmlFor="has-variants" className="text-sm">
          Produk ini memiliki varian (ukuran, warna, dll)
        </Label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button
          type="submit"
          disabled={loading}
          data-testid="btn-product-submit"
        >
          {loading ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
