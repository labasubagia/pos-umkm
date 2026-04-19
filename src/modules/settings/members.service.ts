/**
 * members.service.ts — Member invite and management for the store owner.
 *
 * Invite flow:
 * 1. Owner enters member's email + role in Settings → Manage Members
 * 2. This service shares the store folder via Drive API
 * 3. Appends a row to the `Members` tab in the Master Sheet
 * 4. Returns a Store Link URL the owner can share with the member
 *
 * Revoke flow:
 * - Soft-deletes the Members row (sets deleted_at); does NOT unshare the Drive
 *   folder — that must be done manually in Google Drive by the owner.
 *
 * Note: File lives in `settings` module per TRD module structure,
 * but the invite logic touches the Users sheet (master data).
 */

import { dataAdapter } from '../../lib/adapters'
import type { Role } from '../../lib/adapters/types'
import { validateEmail } from '../../lib/validators'
import { nowUTC } from '../../lib/formatters'
import { generateId } from '../../lib/uuid'

const VALID_ROLES: Role[] = ['owner', 'manager', 'cashier']

/** The base URL of the deployed app (configurable via env var; defaults to current origin). */
function appBaseUrl(): string {
  return (import.meta.env.VITE_APP_URL as string | undefined) ?? globalThis.location?.origin ?? ''
}

export interface Member {
  id: string
  email: string
  name: string
  role: Role
  invited_at: string
  deleted_at: string | null
}

export class MemberError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MemberError'
  }
}

/**
 * Invites a member by:
 * 1. Validating email and role.
 * 2. Sharing the store folder via Drive API.
 * 3. Appending a row to the `Members` tab.
 */
export async function inviteMember(
  email: string,
  role: Role,
  masterSpreadsheetId: string,
): Promise<Member> {
  if (!validateEmail(email).valid) {
    throw new MemberError(`inviteMember: invalid email "${email}"`)
  }
  if (!VALID_ROLES.includes(role)) {
    throw new MemberError(`inviteMember: role must be one of ${VALID_ROLES.join(', ')}`)
  }

  try {
    await dataAdapter.shareSpreadsheet(masterSpreadsheetId, email, 'editor')
  } catch (err) {
    throw new MemberError(`inviteMember: Drive API share failed — ${String(err)}`)
  }

  const member: Member = {
    id: generateId(),
    email,
    name: '',
    role,
    invited_at: nowUTC(),
    deleted_at: null,
  }

  await dataAdapter.appendRow('Members', member as unknown as Record<string, unknown>)
  return member
}

/**
 * Generates a Store Link URL that embeds the spreadsheetId.
 * The member opens this link in their browser to join the store.
 */
export function generateStoreLink(spreadsheetId: string): string {
  return `${appBaseUrl()}/join?sid=${encodeURIComponent(spreadsheetId)}`
}

/**
 * Soft-deletes a member's Members row, effectively revoking their role.
 * Note: does NOT call Drive API to unshare — the owner must do that manually
 * in Google Drive if they want to fully revoke folder access.
 */
export async function revokeMember(userId: string): Promise<void> {
  await dataAdapter.softDelete('Members', userId)
}

/**
 * Returns all active (non-deleted) members from the Members tab.
 */
export async function listMembers(): Promise<Member[]> {
  const rows = await dataAdapter.getSheet('Members')
  return rows
    .filter((r) => !r['deleted_at'] && typeof r['email'] === 'string' && r['email'] !== '')
    .map((r) => ({
      id: r['id'] as string,
      email: r['email'] as string,
      name: (r['name'] as string) ?? '',
      role: r['role'] as Role,
      invited_at: r['invited_at'] as string,
      deleted_at: null,
    }))
}
