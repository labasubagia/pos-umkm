/**
 * DexieSheetRepository.test.ts — Unit tests for offline-first IndexedDB repo.
 *
 * Uses fake-indexeddb to run Dexie in a Node.js test environment without
 * a real browser. Each test starts with a fresh database to avoid state leakage.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DexieSheetRepository } from './DexieSheetRepository'
import { getDb, clearDbCache } from './db'
import type { ISheetRepository } from '../SheetRepository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_STORE_ID = 'test-store'

/** Minimal stub that satisfies ISheetRepository<T> */
function makeRemoteStub<T extends Record<string, unknown>>(): ISheetRepository<T> {
  return {
    spreadsheetId: 'remote-id',
    sheetName:     'Products',
    getAll:             async () => [],
    batchAppend:        async () => {},
    batchUpdateCells:   async () => {},
    batchUpsertByKey:   async () => {},
    softDelete:         async () => {},
    writeHeaders:       async () => {},
  }
}

type ProductRow = { id: string; name: string; price: number; deleted_at?: string | null }

function makeRepo(sheetName = 'Products') {
  return new DexieSheetRepository<ProductRow>(
    getDb(TEST_STORE_ID),
    'spreadsheet-1',
    sheetName,
    () => makeRemoteStub<ProductRow>(),
  )
}

// Reset Dexie tables between tests
beforeEach(async () => {
  const db = getDb(TEST_STORE_ID)
  await db.Products.clear()
  await db._outbox.clear()
  await db._syncMeta.clear()
})

afterEach(() => {
  clearDbCache()
})

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('returns empty array when IndexedDB is empty', async () => {
    const repo = makeRepo()
    expect(await repo.getAll()).toEqual([])
  })

  it('returns rows that have no deleted_at', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.bulkPut([
      { id: 'p1', name: 'Produk A', price: 1000, deleted_at: null },
      { id: 'p2', name: 'Produk B', price: 2000, deleted_at: '' },
    ])
    const rows = await makeRepo().getAll()
    expect(rows).toHaveLength(2)
  })

  it('filters out soft-deleted rows', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.bulkPut([
      { id: 'p1', name: 'Aktif',   price: 1000, deleted_at: null },
      { id: 'p2', name: 'Dihapus', price: 2000, deleted_at: '2026-01-01T00:00:00Z' },
    ])
    const rows = await makeRepo().getAll()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('p1')
  })
})

// ─── batchAppend ──────────────────────────────────────────────────────────────

describe('batchAppend', () => {
  it('stores rows in IndexedDB', async () => {
    const db = getDb(TEST_STORE_ID)
    const repo = makeRepo()
    await repo.batchAppend([{ id: 'p1', name: 'Indomie', price: 3500 }])
    const stored = await db.Products.get('p1')
    expect(stored).toMatchObject({ id: 'p1', name: 'Indomie', price: 3500 })
  })

  it('auto-generates id when row has none', async () => {
    const db = getDb(TEST_STORE_ID)
    const repo = makeRepo()
    await repo.batchAppend([{ name: 'Teh Botol', price: 5000 } as ProductRow])
    const all = await db.Products.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBeTruthy()
  })

  it('queues an outbox entry with op=append', async () => {
    const db = getDb(TEST_STORE_ID)
    await makeRepo().batchAppend([{ id: 'p1', name: 'Es Teh', price: 4000 }])
    const entries = await db._outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].operation.op).toBe('append')
    expect(entries[0].status).toBe('pending')
    expect(entries[0].sheetName).toBe('Products')
    expect(entries[0].spreadsheetId).toBe('spreadsheet-1')
  })

  it('is a no-op for empty rows array', async () => {
    const db = getDb(TEST_STORE_ID)
    await makeRepo().batchAppend([])
    expect(await db._outbox.count()).toBe(0)
  })
})

// ─── batchUpdateCells ─────────────────────────────────────────────────────────

describe('batchUpdateCells', () => {
  it('updates the column in IndexedDB', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Roti', price: 2000, deleted_at: null })
    await makeRepo().batchUpdateCells([{ rowId: 'p1', column: 'price', value: 2500 }])
    const updated = await db.Products.get('p1')
    expect(updated?.price).toBe(2500)
  })

  it('queues an outbox entry with op=batchUpdateCells', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Roti', price: 2000, deleted_at: null })
    await makeRepo().batchUpdateCells([{ rowId: 'p1', column: 'price', value: 2500 }])
    const entry = (await db._outbox.toArray())[0]
    expect(entry.operation.op).toBe('batchUpdateCells')
  })

  it('skips rows not found locally (race condition guard)', async () => {
    const db = getDb(TEST_STORE_ID)
    // Row doesn't exist in Dexie yet — should not throw
    await makeRepo().batchUpdateCells([{ rowId: 'missing', column: 'price', value: 1 }])
    // Outbox entry is still queued — SyncManager will handle it
    expect(await db._outbox.count()).toBe(1)
  })

  it('is a no-op for empty updates array', async () => {
    const db = getDb(TEST_STORE_ID)
    await makeRepo().batchUpdateCells([])
    expect(await db._outbox.count()).toBe(0)
  })
})

// ─── softDelete ───────────────────────────────────────────────────────────────

describe('softDelete', () => {
  it('sets deleted_at on the row in IndexedDB', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Mie', price: 3000, deleted_at: null })
    await makeRepo().softDelete('p1')
    const row = await db.Products.get('p1')
    expect(row?.deleted_at).toBeTruthy()
  })

  it('queues an outbox entry with op=softDelete', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Mie', price: 3000, deleted_at: null })
    await makeRepo().softDelete('p1')
    const entry = (await db._outbox.toArray())[0]
    expect(entry.operation.op).toBe('softDelete')
    expect((entry.operation as { op: 'softDelete'; rowId: string }).rowId).toBe('p1')
  })

  it('row no longer returned by getAll() after soft delete', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Mie', price: 3000, deleted_at: null })
    const repo = makeRepo()
    await repo.softDelete('p1')
    expect(await repo.getAll()).toHaveLength(0)
  })
})

// ─── batchUpsertByKey ─────────────────────────────────────────────────────────

describe('batchUpsertByKey', () => {
  it('updates existing rows and inserts new ones', async () => {
    const db = getDb(TEST_STORE_ID)
    await db.Products.put({ id: 'p1', name: 'Teh', price: 3000, deleted_at: null })
    const repo = makeRepo()
    await repo.batchUpsertByKey(
      'name', 'price',
      [
        { lookupValue: 'Teh',  value: 3500 }, // update
        { lookupValue: 'Kopi', value: 5000 }, // insert
      ],
      (name, price) => ({ id: `new-${name}`, name, price, deleted_at: null }),
    )
    const all = await db.Products.toArray()
    expect(all).toHaveLength(2)
    const teh = all.find((r) => r.name === 'Teh')
    expect(teh?.price).toBe(3500)
    const kopi = all.find((r) => r.name === 'Kopi')
    expect(kopi).toBeTruthy()
  })
})

// ─── writeHeaders ─────────────────────────────────────────────────────────────

describe('writeHeaders', () => {
  it('delegates to the remote repo', async () => {
    const remote = makeRemoteStub<ProductRow>()
    let called = false
    remote.writeHeaders = async (_headers) => { called = true }
    const repo = new DexieSheetRepository<ProductRow>(getDb(TEST_STORE_ID), 'id', 'Products', () => remote)
    await repo.writeHeaders(['id', 'name'])
    expect(called).toBe(true)
  })
})
