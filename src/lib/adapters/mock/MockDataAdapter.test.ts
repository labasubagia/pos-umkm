/**
 * Unit tests for MockDataAdapter.
 * Uses jsdom's localStorage (provided by vitest jsdom environment).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { MockDataAdapter } from './MockDataAdapter'
import { AdapterError } from '../types'

// jsdom's localStorage.clear() may not be available in all vitest versions.
// Use a Map-backed mock for full control.
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock)
})

describe('MockDataAdapter', () => {
  let adapter: MockDataAdapter

  beforeEach(() => {
    localStorage.clear()
    adapter = new MockDataAdapter()
  })

  it('appendRow stores row in localStorage under correct key', async () => {
    await adapter.appendRow('Products', { name: 'Nasi Goreng', price: 15000 })
    const raw = localStorage.getItem('mock_Products')
    expect(raw).not.toBeNull()
    const rows = JSON.parse(raw!)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Nasi Goreng')
  })

  it('getSheet returns all non-deleted rows', async () => {
    await adapter.appendRow('Products', { name: 'Row 1' })
    await adapter.appendRow('Products', { name: 'Row 2', deleted_at: '2026-01-01T00:00:00.000Z' })
    const rows = await adapter.getSheet('Products')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Row 1')
  })

  it('getSheet returns empty array when key does not exist', async () => {
    const rows = await adapter.getSheet('NonExistent')
    expect(rows).toEqual([])
  })

  it('updateCell modifies correct field on correct row', async () => {
    await adapter.appendRow('Products', { id: 'prod-1', name: 'Old Name', price: 10000 })
    await adapter.updateCell('Products', 'prod-1', 'name', 'New Name')
    const rows = await adapter.getSheet('Products')
    expect(rows[0].name).toBe('New Name')
    expect(rows[0].price).toBe(10000)
  })

  it('softDelete sets deleted_at on correct row', async () => {
    await adapter.appendRow('Products', { id: 'prod-1', name: 'Test' })
    await adapter.softDelete('Products', 'prod-1')
    // Read raw localStorage to verify deleted_at was set
    const raw = localStorage.getItem('mock_Products')
    const rows = JSON.parse(raw!) as Record<string, unknown>[]
    const deleted = rows.find((r) => r['id'] === 'prod-1')
    expect(deleted?.['deleted_at']).toBeTruthy()
  })

  it('softDelete does not physically remove the row', async () => {
    await adapter.appendRow('Products', { id: 'prod-1', name: 'Test' })
    await adapter.softDelete('Products', 'prod-1')
    const raw = localStorage.getItem('mock_Products')
    const rows = JSON.parse(raw!)
    expect(rows).toHaveLength(1) // still in storage, just flagged
  })

  it('createSpreadsheet stores and returns a UUID', async () => {
    const id = await adapter.createSpreadsheet('Test Store')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(localStorage.getItem('mock_masterSpreadsheetId')).toBe(id)
  })

  it('updateCell throws if rowId not found', async () => {
    await adapter.appendRow('Products', { id: 'prod-1', name: 'Test' })
    await expect(adapter.updateCell('Products', 'non-existent', 'name', 'X')).rejects.toThrow('not found')
  })

  it('softDelete throws if rowId not found', async () => {
    await adapter.appendRow('Products', { id: 'prod-1', name: 'Test' })
    await expect(adapter.softDelete('Products', 'non-existent')).rejects.toThrow('not found')
  })
})
