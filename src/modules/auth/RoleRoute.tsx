/**
 * RoleRoute — role-based route access control.
 *
 * Wraps routes that require a minimum role level. Users with insufficient
 * role are redirected to /cashier (the least-privileged route).
 *
 * Role hierarchy: cashier < manager < owner
 *
 * This is UI-level enforcement only — there is no backend to enforce it.
 * This is acceptable for the family-trust model described in TRD §3.4.
 */
import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../../lib/adapters/types'

/** Numeric rank for role comparison (higher = more privileged). */
const ROLE_RANK: Record<Role, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
}

interface RoleRouteProps {
  /** Minimum role required to access this route. */
  minRole: Role
  children: ReactNode
}

export function RoleRoute({ minRole, children }: RoleRouteProps) {
  const { isAuthenticated, role } = useAuth()

  // Not authenticated at all — ProtectedRoute should have caught this,
  // but guard defensively to avoid a blank screen.
  if (!isAuthenticated || !role) {
    return <Navigate to="/" replace />
  }

  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return <Navigate to="/cashier" replace />
  }

  return <>{children}</>
}
