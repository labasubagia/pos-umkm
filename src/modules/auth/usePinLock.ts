/**
 * usePinLock — idle timer and PIN lock state management.
 *
 * After `idleMs` milliseconds with no user interaction, the terminal
 * is locked. The cashier must enter their PIN to unlock.
 *
 * Idle detection listens for: mousemove, keydown, touchstart.
 * These are the three most reliable cross-device interaction signals.
 *
 * PIN verification is async (bcrypt.compare). The lock state is held
 * in local React state — not in Zustand — because it is UI-only and
 * does not need to be shared across components.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { verifyPIN } from "./pin.service";

const IDLE_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "touchstart",
];

/** Default idle timeout: 5 minutes (configurable via idleMs prop). */
const DEFAULT_IDLE_MS = 5 * 60 * 1000;

interface UsePinLockOptions {
  /** PIN hash stored for the current user. If null, locking is disabled. */
  pinHash: string | null;
  /** Idle duration in ms before the terminal auto-locks. */
  idleMs?: number;
}

interface UsePinLockReturn {
  isLocked: boolean;
  unlock: (enteredPin: string) => Promise<boolean>;
  lock: () => void;
  resetTimer: () => void;
}

export function usePinLock({
  pinHash,
  idleMs = DEFAULT_IDLE_MS,
}: UsePinLockOptions): UsePinLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setIsLocked(true);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only start the idle timer when a PIN hash is configured.
    if (pinHash) {
      timerRef.current = setTimeout(lock, idleMs);
    }
  }, [pinHash, idleMs, lock]);

  // Wire up idle event listeners and start the initial timer.
  useEffect(() => {
    resetTimer();
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, resetTimer));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  const unlock = useCallback(
    async (enteredPin: string): Promise<boolean> => {
      if (!pinHash) return false;
      const ok = await verifyPIN(enteredPin, pinHash);
      if (ok) setIsLocked(false);
      return ok;
    },
    [pinHash],
  );

  return { isLocked, unlock, lock, resetTimer };
}
