/**
 * ProtectedRoute — redirects unauthenticated users to the landing page.
 *
 * Wrap any route that requires a signed-in user with this component.
 * Role-specific access control is handled by RoleRoute (T019).
 */
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
