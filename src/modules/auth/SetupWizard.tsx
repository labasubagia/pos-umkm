/**
 * SetupWizard — onboarding form for first-time store owners.
 *
 * Collects business name and PPN toggle.
 * On submit: creates master spreadsheet, initializes all tabs,
 * and navigates to /cashier.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getRepos } from "../../lib/adapters";
import { nowUTC } from "../../lib/formatters";
import { runStoreSetup } from "./setup.service";
import { useAuth } from "./useAuth";

export default function SetupWizard() {
  const navigate = useNavigate();
  const { setStoreSession, user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [ppnEnabled, setPpnEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      setError("Nama usaha wajib diisi");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { masterSpreadsheetId, monthlySpreadsheetId } = await runStoreSetup(
        businessName.trim(),
        user?.email ?? "",
      );

      // Persist settings as key-value rows (matching settings.service.ts read format)
      const settingsRows = [
        { key: "business_name", value: businessName.trim() },
        { key: "tax_rate", value: ppnEnabled ? 11 : 0 },
        { key: "receipt_footer", value: "" },
      ];
      const ts = nowUTC();
      await getRepos().settings.batchInsert(
        settingsRows.map((s) => ({ ...s, updated_at: ts })),
      );

      // runStoreSetup writes activeStoreId to localStorage — read it back so
      // we can atomically update the Zustand store and navigate to the URL.
      const storeId = localStorage.getItem("activeStoreId") ?? "";
      setStoreSession(masterSpreadsheetId, monthlySpreadsheetId, storeId);
      if (storeId) {
        navigate(`/${storeId}/cashier`);
      } else {
        navigate("/stores");
      }
    } catch (err) {
      setError(`Setup gagal: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Selamat Datang di POS UMKM</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="setup-business-name">Nama Usaha</Label>
          <Input
            id="setup-business-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Nama usaha Anda"
            required
            data-testid="input-business-name"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="setup-ppn"
            checked={ppnEnabled}
            onCheckedChange={(checked) => setPpnEnabled(checked === true)}
          />
          <Label htmlFor="setup-ppn">Aktifkan PPN 11%</Label>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} data-testid="btn-setup-submit">
          {loading ? "Menyiapkan..." : "Mulai Sekarang"}
        </Button>
      </form>
    </div>
  );
}
