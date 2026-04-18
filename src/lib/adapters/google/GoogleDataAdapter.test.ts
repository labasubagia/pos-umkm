/**
 * Unit tests for GoogleDataAdapter using MSW for HTTP mocking.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { GoogleDataAdapter } from './GoogleDataAdapter'

const SPREADSHEET_ID = 'test-spreadsheet-id'
const TOKEN = 'test-token'
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`

const FAKE_SHEET_VALUES = {
  range: 'Products!A1:Z1000',
  majorDimension: 'ROWS',
  values: [
    ['id', 'name', 'price', 'deleted_at'],
    ['prod-1', 'Nasi Goreng', '15000', ''],
    ['prod-2', 'Es Teh', '5000', ''],
  ],
}

const server = setupServer(
  http.get(`${BASE}/values/:range`, () => HttpResponse.json(FAKE_SHEET_VALUES)),
  http.post(`${BASE}/values/:range\\:append`, () =>
    HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      tableRange: 'Products!A1:D2',
      updates: { spreadsheetId: SPREADSHEET_ID, updatedRange: 'Products!A3', updatedRows: 1, updatedColumns: 4, updatedCells: 4 },
    })
  ),
  http.put(`${BASE}/values/:range`, () =>
    HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      updatedRange: 'Products!D2',
      updatedRows: 1,
      updatedColumns: 1,
      updatedCells: 1,
    })
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeAdapter() {
  return new GoogleDataAdapter(SPREADSHEET_ID, () => TOKEN)
}

describe('GoogleDataAdapter', () => {
  describe('getSheet', () => {
    it('fetches correct spreadsheetId and range', async () => {
      let requestedPath = ''
      server.use(
        http.get(`${BASE}/values/:range`, ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json(FAKE_SHEET_VALUES)
        }),
      )
      const adapter = makeAdapter()
      await adapter.getSheet('Products')
      expect(requestedPath).toContain(SPREADSHEET_ID)
      expect(requestedPath).toContain('Products')
    })

    it('maps header row columns to object keys', async () => {
      const adapter = makeAdapter()
      const rows = await adapter.getSheet('Products')
      expect(rows[0]).toHaveProperty('id', 'prod-1')
      expect(rows[0]).toHaveProperty('name', 'Nasi Goreng')
      expect(rows[0]).toHaveProperty('price', '15000')
    })

    it('throws AdapterError on Sheets API 403', async () => {
      server.use(
        http.get(`${BASE}/values/:range`, () => new HttpResponse('Forbidden', { status: 403 })),
      )
      const adapter = makeAdapter()
      await expect(adapter.getSheet('Products')).rejects.toThrow('getSheet failed')
    })
  })

  describe('appendRow', () => {
    it('maps object fields to ordered row array', async () => {
      let capturedBody: unknown
      server.use(
        http.post(`${BASE}/values/:range\\:append`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            tableRange: 'Products!A1:D2',
            updates: { spreadsheetId: SPREADSHEET_ID, updatedRange: 'Products!A3', updatedRows: 1, updatedColumns: 4, updatedCells: 4 },
          })
        }),
      )
      const adapter = makeAdapter()
      await adapter.appendRow('Products', { id: 'prod-3', name: 'Mie Goreng', price: 12000 })
      expect(capturedBody).toBeDefined()
      const body = capturedBody as { values: unknown[][] }
      expect(body.values[0]).toContain('prod-3')
      expect(body.values[0]).toContain('Mie Goreng')
    })

    it('throws AdapterError on Sheets API 429 after retries', async () => {
      server.use(
        http.post(`${BASE}/values/:range\\:append`, () => new HttpResponse(null, { status: 429 })),
      )
      const adapter = makeAdapter()
      await expect(
        adapter.appendRow('Products', { name: 'Test' })
      ).rejects.toThrow('appendRow failed')
    })
  })

  describe('updateCell', () => {
    it('reads row number then sends targeted update', async () => {
      let updateUrl = ''
      server.use(
        http.put(`${BASE}/values/:range`, ({ request }) => {
          updateUrl = new URL(request.url).pathname
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            updatedRange: 'Products!D2',
            updatedRows: 1, updatedColumns: 1, updatedCells: 1,
          })
        }),
      )
      const adapter = makeAdapter()
      await adapter.updateCell('Products', 'prod-1', 'deleted_at', '2026-01-01T00:00:00.000Z')
      // D is column index 3 (id=A, name=B, price=C, deleted_at=D), row 2 (first data row)
      expect(updateUrl).toContain('D2')
    })
  })

  describe('softDelete', () => {
    it('sets deleted_at on correct cell', async () => {
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/values/:range`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            updatedRange: 'Products!D2',
            updatedRows: 1, updatedColumns: 1, updatedCells: 1,
          })
        }),
      )
      const adapter = makeAdapter()
      await adapter.softDelete('Products', 'prod-1')
      const body = capturedBody as { values: string[][] }
      // The value should be an ISO timestamp
      expect(body.values[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
