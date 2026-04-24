/**
 * AuthProvider — wraps the application with Google OAuth context.
 *
 * Uses a GIS script tag approach (no @react-oauth/google package dependency)
 * to keep the bundle lean. `VITE_GOOGLE_CLIENT_ID` is required in production.
 * The GIS script is loaded via the index.html <script> tag; wiring happens
 * in GoogleAuthAdapter.
 *
 * Children are always rendered — auth state is controlled via useAuth store.
 */
import type { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}
