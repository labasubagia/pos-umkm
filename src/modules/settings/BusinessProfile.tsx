/**
 * BusinessProfile — Form for editing business settings.
 *
 * Loads settings via useSettings() (React Query). On save, calls saveSettings
 * and invalidates the settings query. If business_name changed, also syncs
 * to the main spreadsheet and invalidates the stores query.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { SETTINGS_QUERY_KEY, useSettings } from "../../hooks/useSettings";
import { STORES_QUERY_KEY } from "../../hooks/useStores";
import { useAuthStore } from "../../store/authStore";
import { updateStoreName } from "../auth/setup.service";
import { useAuth } from "../auth/useAuth";
import { type BusinessSettings, saveSettings } from "./settings.service";

export function BusinessProfile() {
  const { activeStoreId, spreadsheetId } = useAuth();
  const zustandActiveStoreId = useAuthStore((s) => s.activeStoreId);
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSettings();

  const [form, setForm] = useState<BusinessSettings>({
    business_name: "",
    tax_rate: 11,
    receipt_footer: "",
    qris_image_url: "",
  });
  const [initialName, setInitialName] = useState("");
  const [success, setSuccess] = useState(false);

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setForm(settings);
      setInitialName(settings.business_name);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveSettings(form);
      if (
        form.business_name !== initialName &&
        activeStoreId &&
        spreadsheetId
      ) {
        await updateStoreName(activeStoreId, form.business_name);
        void queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY });
        setInitialName(form.business_name);
      }
      void queryClient.invalidateQueries({
        queryKey: SETTINGS_QUERY_KEY(zustandActiveStoreId),
      });
    },
    onSuccess: () => setSuccess(true),
    onError: () => setSuccess(false),
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "tax_rate" ? parseInt(value, 10) : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    saveMutation.mutate();
  }

  if (isLoading)
    return <p className="p-4 text-sm text-gray-500">Memuat pengaturan…</p>;

  return (
    <form
      data-testid="business-profile-form"
      onSubmit={handleSubmit}
      className="space-y-4 max-w-lg"
    >
      <div className="space-y-1.5">
        <Label htmlFor="business_name">Nama Bisnis</Label>
        <Input
          id="business_name"
          data-testid="input-business-name"
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tax_rate">Tarif PPN (%)</Label>
        <Input
          id="tax_rate"
          data-testid="input-tax-rate"
          type="number"
          name="tax_rate"
          min={0}
          max={99}
          value={form.tax_rate}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receipt_footer">Footer Struk</Label>
        <Input
          id="receipt_footer"
          data-testid="input-receipt-footer"
          type="text"
          name="receipt_footer"
          value={form.receipt_footer}
          onChange={handleChange}
        />
      </div>

      {success && (
        <Alert
          className="border-green-500 bg-green-50 text-green-800"
          data-testid="profile-save-success"
        >
          <AlertDescription>Pengaturan berhasil disimpan.</AlertDescription>
        </Alert>
      )}
      {saveMutation.isError && (
        <Alert variant="destructive" data-testid="profile-save-error">
          <AlertDescription>{String(saveMutation.error)}</AlertDescription>
        </Alert>
      )}

      <Button
        data-testid="btn-save-profile"
        type="submit"
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
