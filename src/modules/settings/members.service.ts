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

import { driveClient, getRepos } from "../../lib/adapters";
import type { Role } from "../../lib/adapters/types";
import { nowUTC } from "../../lib/formatters";
import { generateId } from "../../lib/uuid";
import { validateEmail } from "../../lib/validators";

const VALID_ROLES: Role[] = ["owner", "manager", "cashier"];

/** The base URL of the deployed app (configurable via env var; defaults to current origin). */
function appBaseUrl(): string {
  return (
    (import.meta.env.VITE_APP_URL as string | undefined) ??
    globalThis.location?.origin ??
    ""
  );
}

export interface Member {
  id: string;
  google_user_id: string;
  email: string;
  name: string;
  role: Role;
  invited_at: string;
  deleted_at: string | null;
}

export class MemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberError";
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
    throw new MemberError(`inviteMember: invalid email "${email}"`);
  }
  if (!VALID_ROLES.includes(role)) {
    throw new MemberError(
      `inviteMember: role must be one of ${VALID_ROLES.join(", ")}`,
    );
  }

  try {
    await driveClient.shareSpreadsheet(masterSpreadsheetId, email, "editor");
  } catch (err) {
    throw new MemberError(
      `inviteMember: Drive API share failed — ${String(err)}`,
    );
  }

  const member: Member = {
    id: generateId(),
    google_user_id: "",
    email,
    name: "",
    role,
    invited_at: nowUTC(),
    deleted_at: null,
  };

  await getRepos().members.batchInsert([
    member as unknown as Record<string, unknown>,
  ]);
  return member;
}

/**
 * Generates a Store Link URL that embeds the spreadsheetId.
 * The member opens this link in their browser to join the store.
 */
export function generateStoreLink(spreadsheetId: string): string {
  return `${appBaseUrl()}/join?sid=${encodeURIComponent(spreadsheetId)}`;
}

/**
 * Soft-deletes a member's Members row, effectively revoking their role.
 * Note: does NOT call Drive API to unshare — the owner must do that manually
 * in Google Drive if they want to fully revoke folder access.
 */
export async function revokeMember(userId: string): Promise<void> {
  await getRepos().members.softDelete(userId);
}

/**
 * Returns all active (non-deleted) members from the Members tab.
 */
export async function listMembers(): Promise<Member[]> {
  const rows = await getRepos().members.getAll();
  return rows
    .filter((r) => {
      const rr = r as Record<string, unknown>;
      return !rr.deleted_at && typeof rr.email === "string" && rr.email !== "";
    })
    .map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        id: rr.id as string,
        google_user_id: (rr.google_user_id as string) ?? "",
        email: rr.email as string,
        name: (rr.name as string) ?? "",
        role: rr.role as Role,
        invited_at: rr.invited_at as string,
        deleted_at: null,
      };
    });
}

/**
 * Records the Google user ID for a member after they sign in.
 * Called on each sign-in so the ID stays current even if it changes.
 * No-op if no active row is found for the given email.
 */
export async function recordGoogleUserId(
  email: string,
  googleUserId: string,
): Promise<void> {
  const rows = await getRepos().members.getAll();
  const existing = rows.find(
    (r) =>
      (r as Record<string, unknown>).email === email &&
      !(r as Record<string, unknown>).deleted_at,
  );
  if (!existing) return;
  await getRepos().members.batchUpdate([
    {
      id: (existing as Record<string, unknown>).id as string,
      google_user_id: googleUserId,
    },
  ]);
}
