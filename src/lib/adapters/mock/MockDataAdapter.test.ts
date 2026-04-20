/**
 * Unit tests for MockSheetRepository.
 * Uses jsdom's localStorage (provided by vitest jsdom environment).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { MockSheetRepository } from '../MockSheetRepository'
import { AdapterError } from '../types'

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

type ProductRow = { id: string; name: string; price: number; deleted_at: string | null }

describe('MockSheetRepository', () => {
  let repo: MockSheetRepository<ProductRow>

  beforeEach(() => {
    localStorage.clear()
    repo = new MockSheetRepository<ProductRow>('Products')
  })

  it('is bound to the given sheetName', () => {
    expect(repo.sheetName).toBe('Products')
    expect(repo.spreadsheetId).toBe('mock')
  })

  it('batchAppend stores rows in localStorage under correct key', async () => {
    await repo.batchAppend([{ name: 'Nasi Goreng', price: 15000 }])
    const raw = localStorage.getItem('mock_Products')
    expect(raw).not.toBeNull()
    const rows = JSON.parse(raw!)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Nasi Goreng')
  })

  it('getAll returns all non-deleted rows', async () => {
    await repo.batchAppend([
      { name: 'Row 1' },
      { name: 'Row 2', deleted_at: '2026-01-01T00:00:00.000Z' },
    ])
    const rows = await repo.getAll()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Row 1')
  })

  it('getAll returns empty array when sheet is empty', async () => {
    const rows = await repo.getAll()
    expect(rows).toEqual([])
  })

  it('batchUpdateCells modifies correct field on correct row', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Old Name', price: 10000 }])
    await repo.batchUpdateCells([{ rowId: 'prod-1', column: 'name', value: 'New Name' }])
    const rows = await repo.getAll()
    expect(rows[0].name).toBe('New Name')
    expect(rows[0].price).toBe(10000)
  })

  it('batchUpdateCells throws AdapterError if rowId not found', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Test' }])
    await expect(repo.batchUpdateCells([{ rowId: 'non-existent', column: 'name', value: 'X' }])).rejects.toThrow(AdapterError)
    await expect(repo.batchUpdateCells([{ rowId: 'non-existent', column: 'name', value: 'X' }])).rejects.toThrow('not found')
  })

  it('softDelete sets deleted_at on correct row', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Test' }])
    await repo.softDelete('prod-1')
    const raw = localStorage.getItem('mock_Products')
    const rows = JSON.parse(raw!) as Record<string, unknown>[]
    const deleted = rows.find((r) => r['id'] === 'prod-1')
    expect(deleted?.['deleted_at']).toBeTruthy()
  })

  it('softDelete does not physically remove the row', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Test' }])
    await repo.softDelete('prod-1')
    const raw = localStorage.getItem('mock_Products')
    const rows = JSON.parse(raw!)
    expect(rows).toHaveLength(1)
  })

  it('softDelete throws AdapterError if rowId not found', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Test' }])
    await expect(repo.softDelete('non-existent')).rejects.toThrow(AdapterError)
    await expect(repo.softDelete('non-existent')).rejects.toThrow('not found')
  })

  it('batchUpdateCells applies all updates in order', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Original', price: 10000 }])
    await repo.batchUpdateCells([
      { rowId: 'prod-1', column: 'name', value: 'Updated' },
      { rowId: 'prod-1', column: 'price', value: 20000 },
    ])
    const rows = await repo.getAll()
    expect(rows[0].name).toBe('Updated')
    expect(rows[0].price).toBe(20000)
  })

  it('batchUpsertByKey updates existing and inserts new entries', async () => {
    await repo.batchAppend([{ id: 'prod-1', name: 'Existing', price: 10000 }])
    const makeNewRow = (lookupValue: string, value: unknown) => ({
      name: lookupValue,
      price: value,
    })
    await repo.batchUpsertByKey('name', 'price', [
      { lookupValue: 'Existing', value: 99999 },
      { lookupValue: 'New Product', value: 5000 },
    ], makeNewRow)
    const rows = await repo.getAll()
    const existing = rows.find((r) => r.name === 'Existing')
    const newRow = rows.find((r) => r.name === 'New Product')
    expect(existing?.price).toBe(99999)
    expect(newRow).toBeDefined()
    expect(newRow?.price).toBe(5000)
  })

  it('writeHeaders is a no-op', async () => {
    await expect(repo.writeHeaders(['id', 'name', 'price'])).resolves.toBeUndefined()
  })
})

