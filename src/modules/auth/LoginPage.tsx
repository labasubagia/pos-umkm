/**
 * LoginPage — the entry point for unauthenticated users.
 *
 * `AuthInitializer` (mounted at the root) already calls restoreSession() and
 * populates the Zustand auth store on page load. If the user arrives at /login
 * while already authenticated (persisted state), they are redirected to the
 * store picker immediately via <Navigate> — no effect needed.
 *
 * For a fresh login: signIn() is called, then the user is routed to /stores
 * so StorePickerPage can resolve the active store from the live store list.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { authAdapter } from "../../lib/adapters";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "./useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Already authenticated from persisted Zustand state (e.g. refresh, back-navigation).
  // Guard against the case where we're mid sign-in and isAuthenticated just flipped.
  if (isAuthenticated && !signingIn) {
    const storeId = useAuthStore.getState().activeStoreId;
    return <Navigate to={storeId ? `/${storeId}/cashier` : "/stores"} replace />;
  }

  /**
   * Navigation after a successful fresh sign-in.
   *
   * Navigate to /stores so StorePickerPage can resolve the active store from
   * the current main.Stores contents instead of stale localStorage.
   * The store map + monthly sheets are loaded by AppShell on mount.
   */
  function onAuthenticated(user: Parameters<typeof setUser>[0], token: string) {
    setUser(user, user.role, token);
    navigate("/stores");
  }

  async function handleSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      const user = await authAdapter.signIn();
      onAuthenticated(user, authAdapter.getAccessToken() ?? "");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[LoginPage] sign-in failed:", err);
      setSignInError(errMsg);
      setSigningIn(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">POS UMKM</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Sistem kasir untuk usaha kecil Indonesia
      </p>
      {signInError && (
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{signInError}</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={() => void handleSignIn()}
        data-testid="btn-sign-in"
        disabled={signingIn}
      >
        {signingIn ? "Memproses…" : "Masuk dengan Google"}
      </Button>
    </div>
  );
}
