/**
 * PinLock — full-screen overlay that appears when the terminal is idle.
 *
 * Displays a PIN input. On correct PIN, the lock is removed.
 * On incorrect PIN, shows an error and clears the input.
 */
import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

interface PinLockProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

export function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await onUnlock(pin);
    if (!ok) {
      setError(true);
      setPin("");
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6 p-8"
      data-testid="pin-lock-overlay"
    >
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold">Terminal Terkunci</h2>
        <p className="text-muted-foreground text-sm">
          Masukkan PIN untuk melanjutkan
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4"
      >
        <Input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          className="text-center text-2xl tracking-widest w-40"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
          aria-label="PIN"
          data-testid="input-pin"
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>PIN salah. Coba lagi.</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          disabled={loading || pin.length < 4}
          data-testid="btn-pin-unlock"
        >
          {loading ? "Memverifikasi..." : "Buka Kunci"}
        </Button>
      </form>
    </div>
  );
}
