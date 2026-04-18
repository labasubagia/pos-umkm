/**
 * AuthProvider — wraps the application with Google OAuth context.
 *
 * Uses a GIS script tag approach (no @react-oauth/google package dependency)
 * to keep the bundle lean. The `VITE_GOOGLE_CLIENT_ID` env var is required
 * only in production (VITE_ADAPTER=google); in mock mode it is ignored.
 *
 * Children are always rendered — auth state is controlled via useAuth store.
 */
import { type ReactNode, useEffect } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    // In mock mode there's no GIS script to load, so skip it entirely.
    // In google mode, the GIS script is loaded via the index.html <script> tag.
    // This effect is intentionally empty here; wiring happens in GoogleAuthAdapter.
  }, [])

  return <>{children}</>
}
