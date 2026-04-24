/**
 * Unit tests for SheetRepository using MSW for HTTP mocking.
 */

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SheetRepository } from "./SheetRepository";

const SPREADSHEET_ID = "test-spreadsheet-id";
const TOKEN = "test-token";
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

const FAKE_SHEET_VALUES = {
  range: "Products!A1:Z1000",
  majorDimension: "ROWS",
  values: [
    ["id", "name", "price", "deleted_at"],
    ["prod-1", "Nasi Goreng", "15000", ""],
    ["prod-2", "Es Teh", "5000", ""],
  ],
};

const server = setupServer(
  http.get(`${BASE}/values/:range`, () => HttpResponse.json(FAKE_SHEET_VALUES)),
  http.post(`${BASE}/values/:range\\:append`, () =>
    HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      tableRange: "Products!A1:D2",
      updates: {
        spreadsheetId: SPREADSHEET_ID,
        updatedRange: "Products!A3",
        updatedRows: 1,
        updatedColumns: 4,
        updatedCells: 4,
      },
    }),
  ),
  http.put(`${BASE}/values/:range`, () =>
    HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      updatedRange: "Products!D2",
      updatedRows: 1,
      updatedColumns: 1,
      updatedCells: 1,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

type ProductRow = Record<string, unknown>;

function makeRepo(): SheetRepository<ProductRow> {
  return new SheetRepository<ProductRow>(
    SPREADSHEET_ID,
    "Products",
    () => TOKEN,
  );
}

describe("SheetRepository", () => {
  it("is bound to the given spreadsheetId and sheetName", () => {
    const repo = makeRepo();
    expect(repo.spreadsheetId).toBe(SPREADSHEET_ID);
    expect(repo.sheetName).toBe("Products");
  });

  describe("getAll", () => {
    it("fetches correct spreadsheetId and range", async () => {
      let requestedPath = "";
      server.use(
        http.get(`${BASE}/values/:range`, ({ request }) => {
          requestedPath = new URL(request.url).pathname;
          return HttpResponse.json(FAKE_SHEET_VALUES);
        }),
      );
      await makeRepo().getAll();
      expect(requestedPath).toContain(SPREADSHEET_ID);
      expect(requestedPath).toContain("Products");
    });

    it("maps header row columns to object keys", async () => {
      const rows = await makeRepo().getAll();
      expect(rows[0]).toHaveProperty("id", "prod-1");
      expect(rows[0]).toHaveProperty("name", "Nasi Goreng");
      expect(rows[0]).toHaveProperty("price", "15000");
    });

    it("throws AdapterError on Sheets API 403", async () => {
      server.use(
        http.get(
          `${BASE}/values/:range`,
          () => new HttpResponse("Forbidden", { status: 403 }),
        ),
      );
      await expect(makeRepo().getAll()).rejects.toThrow("getSheet failed");
    });
  });

  describe("batchAppend", () => {
    it("maps object fields to ordered row array", async () => {
      let capturedBody: unknown;
      server.use(
        http.post(`${BASE}/values/:range\\:append`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            tableRange: "Products!A1:D2",
            updates: {
              spreadsheetId: SPREADSHEET_ID,
              updatedRange: "Products!A3",
              updatedRows: 1,
              updatedColumns: 4,
              updatedCells: 4,
            },
          });
        }),
      );
      await makeRepo().batchAppend([
        { id: "prod-3", name: "Mie Goreng", price: 12000 },
      ]);
      expect(capturedBody).toBeDefined();
      const body = capturedBody as { values: unknown[][] };
      expect(body.values[0]).toContain("prod-3");
      expect(body.values[0]).toContain("Mie Goreng");
    });

    it("throws AdapterError on Sheets API 429 after retries", async () => {
      server.use(
        http.post(
          `${BASE}/values/:range\\:append`,
          () => new HttpResponse(null, { status: 429 }),
        ),
      );
      await expect(makeRepo().batchAppend([{ name: "Test" }])).rejects.toThrow(
        "batchAppendRows failed",
      );
    });
  });

  describe("batchUpdateCells", () => {
    it("reads only headers + ID column then sends targeted batchUpdate", async () => {
      let capturedBody: unknown;
      server.use(
        // batchGet returns only header row and ID column — not the full sheet
        http.get(`${BASE}/values\\:batchGet`, () =>
          HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            valueRanges: [
              // range 0: Sheet!1:1 — header row
              {
                range: "Products!1:1",
                majorDimension: "ROWS",
                values: [["id", "name", "price", "deleted_at"]],
              },
              // range 1: Sheet!A:A — ID column (includes header cell, ROWS dimension)
              {
                range: "Products!A:A",
                majorDimension: "ROWS",
                values: [["id"], ["prod-1"], ["prod-2"]],
              },
            ],
          }),
        ),
        http.post(`${BASE}/values\\:batchUpdate`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            totalUpdatedCells: 1,
          });
        }),
      );
      await makeRepo().batchUpdateCells([
        {
          rowId: "prod-1",
          column: "deleted_at",
          value: "2026-01-01T00:00:00.000Z",
        },
      ]);
      // D is column index 3 (id=A, name=B, price=C, deleted_at=D), row 2 (first data row)
      const body = capturedBody as { data: Array<{ range: string }> };
      expect(body.data[0].range).toContain("D2");
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at on correct cell", async () => {
      let capturedBody: unknown;
      server.use(
        http.put(`${BASE}/values/:range`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            spreadsheetId: SPREADSHEET_ID,
            updatedRange: "Products!D2",
            updatedRows: 1,
            updatedColumns: 1,
            updatedCells: 1,
          });
        }),
      );
      await makeRepo().softDelete("prod-1");
      const body = capturedBody as { values: string[][] };
      expect(body.values[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
