/**
 * JoinPage — landing page for members who open a Store Link.
 *
 * The Store Link format: /join?sid=<spreadsheetId>
 *
 * Flow:
 * 1. Extract `sid` from URL query params.
 * 2. Persist the spreadsheetId to localStorage (so the adapter uses it).
 * 3. Show a "Sign in with Google" button.
 * 4. After sign-in, resolve the user's role from the Members tab.
 * 5. Navigate to /cashier.
 *
 * Members only need the `spreadsheets` scope — they access a sheet shared
 * with them, not one they created. The adapter handles scope selection.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { authAdapter } from "../../lib/adapters";
import { recordGoogleUserId } from "../../modules/settings/members.service";
import { resolveUserRole } from "./auth.service";
import { useAuth } from "./useAuth";

export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sid = params.get("sid");

  async function handleJoin() {
    if (!sid) {
      setError("Tautan toko tidak valid. Minta tautan baru dari pemilik toko.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authAdapter.signIn();
      const role = await resolveUserRole(user.email);
      await recordGoogleUserId(user.email, user.id);
      const userWithRole = { ...user, role };
      const token = authAdapter.getAccessToken() ?? "";
      setUser(userWithRole, role, token);
      // Navigate to /stores so StorePickerPage resolves the active store.
      navigate("/stores");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold" data-testid="join-page-heading">
        Bergabung ke Toko
      </h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Anda diundang untuk mengakses toko ini. Masuk dengan akun Google Anda
        untuk melanjutkan.
      </p>
      {error && (
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={() => void handleJoin()}
        disabled={loading}
        data-testid="btn-join-sign-in"
      >
        {loading ? "Memuat..." : "Masuk dengan Google"}
      </Button>
    </div>
  );
}
