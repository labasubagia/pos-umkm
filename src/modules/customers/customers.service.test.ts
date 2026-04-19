/**
 * customers.service tests — covers T036 (Customer Management).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  fetchCustomers,
  addCustomer,
  updateCustomer,
  CustomerError,
} from './customers.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── fetchCustomers ───────────────────────────────────────────────────────────

describe('fetchCustomers', () => {
  it('returns non-deleted customers', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'cus-1', name: 'Budi Santoso', phone: '08111234567', email: 'budi@mail.com', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
      { id: 'cus-2', name: 'Ani Rahayu', phone: '0822222222', email: null, created_at: '2026-01-02T00:00:00.000Z', deleted_at: null },
    ])

    const result = await fetchCustomers()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Budi Santoso')
    expect(result[1].phone).toBe('0822222222')
  })

  it('excludes rows without a name (sentinel rows)', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'init', _initialized: true, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'cus-1', name: 'Budi', phone: '08111234567', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    ])

    const result = await fetchCustomers()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cus-1')
  })
})

// ─── addCustomer ──────────────────────────────────────────────────────────────

describe('addCustomer', () => {
  it('validates phone format before appending', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const result = await addCustomer('Budi Santoso', '08111234567')

    expect(appendSpy).toHaveBeenCalledOnce()
    expect(appendSpy).toHaveBeenCalledWith('Customers', expect.objectContaining({
      name: 'Budi Santoso',
      phone: '08111234567',
    }))
    expect(result.name).toBe('Budi Santoso')
    expect(result.phone).toBe('08111234567')
    expect(result.id).toBeTruthy()
    expect(result.created_at).toBeTruthy()
  })

  it('includes optional email when provided', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const result = await addCustomer('Budi Santoso', '08111234567', 'budi@mail.com')

    expect(appendSpy).toHaveBeenCalledWith('Customers', expect.objectContaining({
      email: 'budi@mail.com',
    }))
    expect(result.email).toBe('budi@mail.com')
  })

  it('throws CustomerError if phone is invalid Indonesian format', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    await expect(addCustomer('Budi Santoso', '12345')).rejects.toThrow(CustomerError)
    await expect(addCustomer('Budi Santoso', 'abc')).rejects.toThrow(CustomerError)
  })

  it('throws CustomerError if duplicate phone already exists', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'cus-1', name: 'Existing', phone: '08111234567', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    ])

    await expect(addCustomer('Budi Santoso', '08111234567')).rejects.toThrow(CustomerError)
  })
})

// ─── updateCustomer ───────────────────────────────────────────────────────────

describe('updateCustomer', () => {
  it('calls batchUpdateCells for each changed field', async () => {
    const batchSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()

    await updateCustomer('cus-1', { name: 'Budi Baru', email: 'baru@mail.com' })

    expect(batchSpy).toHaveBeenCalledWith('Customers', [
      { rowId: 'cus-1', column: 'name', value: 'Budi Baru' },
      { rowId: 'cus-1', column: 'email', value: 'baru@mail.com' },
    ])
  })
})
