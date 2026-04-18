/**
 * auth.service.ts — Role resolution and first-time owner detection.
 *
 * Called after the user authenticates (OAuth token obtained) to determine:
 * 1. Whether this is the owner's first login (no Users rows → setup flow).
 * 2. The user's role by reading the Users tab and matching by email.
 *
 * Uses DataAdapter so it works with both Mock and Google adapters.
 */

import { dataAdapter } from '../../lib/adapters'
import type { Role } from '../../lib/adapters/types'

/** Thrown when a user's email is not found in (or has been revoked from) the Users tab. */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Resolves the role for a given email by reading the Users tab.
 * Throws UnauthorizedError if the email is not found or has been revoked.
 */
export async function resolveUserRole(email: string): Promise<Role> {
  const users = await dataAdapter.getSheet('Users')

  // getSheet already filters out deleted rows, but double-check deleted_at for safety
  const user = users.find(
    (u) => u['email'] === email && !u['deleted_at'],
  )

  if (!user) {
    throw new UnauthorizedError(
      `resolveUserRole: email "${email}" is not authorized to access this store`,
    )
  }

  return user['role'] as Role
}

/**
 * Returns true if the Users tab has no data rows — meaning no owner has set up
 * the store yet. Used to route to /setup on first login.
 */
export async function isFirstTimeOwner(): Promise<boolean> {
  const users = await dataAdapter.getSheet('Users')
  return users.length === 0
}
