/**
 * customers.service.ts — Customer Management business logic.
 *
 * Covers T036 — Customer Management.
 *
 * All reads/writes go through the active DataAdapter — never directly to
 * lib/sheets/. Phone number is the natural identifier; duplicates are rejected.
 *
 * Data model (Master Sheet tab):
 *   Customers: id, name, phone, email, created_at, deleted_at
 */

import { getRepos } from '../../lib/adapters'
import { nowUTC } from '../../lib/formatters'
import { generateId } from '../../lib/uuid'
import { validatePhone } from '../../lib/validators'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  created_at: string
  deleted_at?: string | null
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class CustomerError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'CustomerError'
    this.cause = cause
  }
}

// ─── T036 — Customer CRUD ────────────────────────────────────────────────────

/**
 * Fetches all non-soft-deleted customers from the Customers sheet tab.
 * The adapter's getSheet already filters rows where deleted_at is set.
 */
export async function fetchCustomers(): Promise<Customer[]> {
  const rows = await getRepos().customers.getAll()
  return rows
    .filter((r) => r['name'])
    .map((r) => ({
      id: r['id'] as string,
      name: r['name'] as string,
      phone: r['phone'] as string,
      email: (r['email'] as string | undefined) ?? undefined,
      created_at: r['created_at'] as string,
      deleted_at: (r['deleted_at'] as string | null) ?? null,
    }))
}

/**
 * Appends a new customer row. Validates phone format using the shared
 * validatePhone utility. Rejects duplicate phone numbers to keep the
 * customer list consistent (phone is the natural identifier for UMKM).
 */
export async function addCustomer(
  name: string,
  phone: string,
  email?: string,
): Promise<Customer> {
  const phoneValidation = validatePhone(phone)
  if (!phoneValidation.valid) {
    throw new CustomerError(phoneValidation.error ?? 'Nomor telepon tidak valid')
  }

  // Check for duplicate phone in existing customers
  const existing = await getRepos().customers.getAll()
  const duplicate = existing.find((r) => r['name'] && r['phone'] === phone)
  if (duplicate) {
    throw new CustomerError(`Nomor telepon ${phone} sudah terdaftar`)
  }

  const id = generateId()
  const created_at = nowUTC()
  await getRepos().customers.batchAppend([{
    id,
    name: name.trim(),
    phone,
    email: email ?? '',
    created_at,
    deleted_at: null,
  }])
  return { id, name: name.trim(), phone, email, created_at, deleted_at: null }
}

/**
 * Updates only the provided fields on a customer row.
 * Uses batchUpdateCells so all fields are written in a single API round-trip
 * (1 GET + 1 batchUpdate) instead of N × (GET + PUT).
 */
export async function updateCustomer(
  id: string,
  changes: Partial<Pick<Customer, 'name' | 'phone' | 'email'>>,
): Promise<void> {
  const updates = (Object.entries(changes) as [string, unknown][]).map(([col, val]) => ({
    rowId: id,
    column: col,
    value: val,
  }))
  if (updates.length === 0) return
  await getRepos().customers.batchUpdateCells(updates)
}
