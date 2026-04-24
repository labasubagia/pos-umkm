/**
 * Core types shared across the adapter layer.
 *
 * Data access is handled by ISheetRepository<T> (see SheetRepository.ts).
 * Drive/spreadsheet management is handled by IDriveClient (see DriveClient.ts).
 * Authentication is handled by AuthAdapter below.
 */

/** Role hierarchy: cashier < manager < owner */
export type Role = "owner" | "manager" | "cashier";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * AuthAdapter — abstracts authentication.
 * Implementations: MockAuthAdapter (preset user), GoogleAuthAdapter (GIS OAuth).
 */
export interface AuthAdapter {
  /** Initiates the OAuth flow and returns the signed-in user. */
  signIn(): Promise<User>;

  /** Signs out the current user and clears the session. */
  signOut(): Promise<void>;

  /**
   * Tries to restore a previous session from localStorage without an OAuth popup.
   * Returns the cached User if the stored token is still valid, null if the user
   * must sign in again. No-op (returns null) in MockAuthAdapter.
   */
  restoreSession(): Promise<User | null>;

  /** Returns the current user from memory, or null if not signed in. */
  getCurrentUser(): User | null;

  /** Returns the OAuth access token, or null if not signed in. */
  getAccessToken(): string | null;
}

/** Thrown by adapters when an operation fails due to data or API issues. */
export class AdapterError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AdapterError";
    this.cause = cause;
  }
}
