/**
 * CategoryForm.tsx — Form for creating and editing a category.
 * Used in both "add" (no initialName) and "edit" (initialName provided) modes.
 */

import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

interface Props {
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function CategoryForm({
  initialName = "",
  onSubmit,
  onCancel,
  submitLabel = "Simpan",
}: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Nama kategori tidak boleh kosong");
      return;
    }
    if (name.trim().length > 100) {
      setError("Nama kategori maksimal 100 karakter");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="category-name">Nama Kategori</Label>
        <Input
          id="category-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Contoh: Makanan, Minuman, Snack"
          data-testid="input-category-name"
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button
          type="submit"
          disabled={loading}
          data-testid="btn-category-submit"
        >
          {loading ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
