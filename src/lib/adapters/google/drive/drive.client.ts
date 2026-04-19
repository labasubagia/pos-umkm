/**
 * Google Drive API v3 operations used exclusively by GoogleDataAdapter.
 *
 * Covers spreadsheet creation (via Sheets API + Drive move), folder
 * management, and file sharing. All functions take an explicit token
 * argument so they are stateless and independently testable.
 */
import { AdapterError } from '../../types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

/**
 * Creates a new Google Spreadsheet via the Sheets API (not Drive API) so
 * that tab names can be specified upfront. The Sheets API returns the real
 * spreadsheetId directly; the Drive API file-create endpoint does not.
 *
 * Follows the "find or create" pattern: if a spreadsheet with the same name
 * already exists in the target folder (e.g., from a failed previous setup
 * attempt), its ID is returned instead of creating a duplicate.
 *
 * After creation the file lives in "My Drive" root. If parentFolderId is
 * supplied the file is moved there via a Drive PATCH call.
 */
export async function createSpreadsheet(
  name: string,
  token: string,
  parentFolderId?: string,
  tabs?: string[],
): Promise<string> {
  // ── "Find or create" ────────────────────────────────────────────────────
  if (parentFolderId) {
    const q = `name=${JSON.stringify(name)} and mimeType='application/vnd.google-apps.spreadsheet' and '${parentFolderId}' in parents and trashed=false`
    const searchRes = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const files = searchData.files as Array<{ id: string }>
      if (files.length > 0) return files[0].id
    }
  }

  // ── Create via Sheets API ────────────────────────────────────────────────
  const sheetsBody: Record<string, unknown> = { properties: { title: name } }
  if (tabs && tabs.length > 0) {
    sheetsBody.sheets = tabs.map((title) => ({ properties: { title } }))
  }
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(sheetsBody),
  })
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    throw new AdapterError(`createSpreadsheet failed: ${body}`)
  }
  const data = await createRes.json()
  const spreadsheetId = data.spreadsheetId as string

  // ── Move to target folder ────────────────────────────────────────────────
  if (parentFolderId) {
    const metaRes = await fetch(`${DRIVE_API}/files/${spreadsheetId}?fields=parents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (metaRes.ok) {
      const meta = await metaRes.json()
      const currentParents = ((meta.parents as string[]) ?? []).join(',')
      await fetch(
        `${DRIVE_API}/files/${spreadsheetId}?addParents=${parentFolderId}&removeParents=${currentParents}&fields=id`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } },
      )
    }
  }

  return spreadsheetId
}

/**
 * Ensures each folder in `path` exists under the previous one (starting at
 * Drive root). Creates any missing folders. Returns the leaf folder ID.
 * Used to create `apps/pos_umkm/<Store Name>/` before placing spreadsheets there.
 */
export async function ensureFolder(path: string[], token: string): Promise<string | null> {
  let parentId = 'root'
  for (const name of path) {
    parentId = await ensureDriveFolderUnder(parentId, name, token)
  }
  return parentId
}

/** Shares the spreadsheet by creating a Drive permission. */
export async function shareSpreadsheet(
  spreadsheetId: string,
  email: string,
  role: 'editor' | 'viewer',
  token: string,
): Promise<void> {
  const driveRole = role === 'editor' ? 'writer' : 'reader'
  const res = await fetch(`${DRIVE_API}/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: driveRole, emailAddress: email }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new AdapterError(`shareSpreadsheet failed: ${body}`)
  }
}

/**
 * Finds or creates a Drive folder named `name` directly under `parentId`.
 * Uses the Drive Files list API to avoid creating duplicate folders.
 */
async function ensureDriveFolderUnder(parentId: string, name: string, token: string): Promise<string> {
  const q = `name=${JSON.stringify(name)} and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`
  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!searchRes.ok) {
    throw new AdapterError(`ensureFolder: search failed for "${name}" (HTTP ${searchRes.status})`)
  }
  const searchData = await searchRes.json()
  const files = searchData.files as Array<{ id: string }>
  if (files.length > 0) return files[0].id

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    throw new AdapterError(`ensureFolder: failed to create "${name}": ${body}`)
  }
  const createData = await createRes.json()
  return createData.id as string
}
