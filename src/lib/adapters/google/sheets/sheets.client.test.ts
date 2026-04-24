/**
 * Unit tests for the Sheets API client using MSW for HTTP mocking.
 * MSW intercepts fetch calls in the jsdom environment.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  sheetsGet,
  sheetsAppend,
  sheetsUpdate,
  sheetsBatchGet,
} from "./sheets.client";
import { SheetsApiError } from "./sheets.types";

const SPREADSHEET_ID = "test-spreadsheet-id";
const TOKEN = "test-token";
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

// Fake data — header row + 2 data rows
const FAKE_VALUES = [
  ["id", "name", "price"],
  ["row-1", "Nasi Goreng", "15000"],
  ["row-2", "Es Teh", "5000"],
];

const server = setupServer(
  // sheetsGet — normal
  http.get(`${BASE}/values/:range`, ({ request }) => {
    const url = new URL(request.url);
    const range = url.pathname.split("/values/")[1];
    if (decodeURIComponent(range) === "Products") {
      return HttpResponse.json({
        range: "Products!A1:Z1000",
        majorDimension: "ROWS",
        values: FAKE_VALUES,
      });
    }
    return HttpResponse.json(
      { error: { code: 404, message: "Not found" } },
      { status: 404 },
    );
  }),

  // sheetsAppend
  http.post(`${BASE}/values/:range\\:append`, () => {
    return HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      tableRange: "Products!A1:C2",
      updates: {
        spreadsheetId: SPREADSHEET_ID,
        updatedRange: "Products!A3:C3",
        updatedRows: 1,
        updatedColumns: 3,
        updatedCells: 3,
      },
    });
  }),

  // sheetsUpdate
  http.put(`${BASE}/values/:range`, () => {
    return HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      updatedRange: "Products!B2",
      updatedRows: 1,
      updatedColumns: 1,
      updatedCells: 1,
    });
  }),

  // sheetsBatchGet
  http.get(`${BASE}/values\\:batchGet`, () => {
    return HttpResponse.json({
      spreadsheetId: SPREADSHEET_ID,
      valueRanges: [
        {
          range: "Products!A1:Z1000",
          majorDimension: "ROWS",
          values: FAKE_VALUES,
        },
        {
          range: "Categories!A1:Z1000",
          majorDimension: "ROWS",
          values: [
            ["id", "name"],
            ["cat-1", "Food"],
          ],
        },
      ],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

describe("sheetsGet", () => {
  it("returns parsed 2D array of row values", async () => {
    const rows = await sheetsGet(SPREADSHEET_ID, "Products", TOKEN);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["row-1", "Nasi Goreng", "15000"]);
  });

  it("strips header row (row 1) from result", async () => {
    const rows = await sheetsGet(SPREADSHEET_ID, "Products", TOKEN);
    // First element should NOT be the header
    expect(rows[0][0]).not.toBe("id");
    expect(rows[0]).toEqual(["row-1", "Nasi Goreng", "15000"]);
  });
});

describe("sheetsAppend", () => {
  it("sends correct range and values", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/values/:range\\:append`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          spreadsheetId: SPREADSHEET_ID,
          tableRange: "Products!A1:C2",
          updates: {
            spreadsheetId: SPREADSHEET_ID,
            updatedRange: "Products!A3",
            updatedRows: 1,
            updatedColumns: 3,
            updatedCells: 3,
          },
        });
      }),
    );
    const newRows = [["row-3", "Mie Goreng", "12000"]];
    await sheetsAppend(SPREADSHEET_ID, "Products", newRows, TOKEN);
    expect(capturedBody).toEqual({ values: newRows });
  });
});

describe("sheetsUpdate", () => {
  it("sends correct range and single-cell value", async () => {
    let capturedBody: unknown;
    server.use(
      http.put(`${BASE}/values/:range`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          spreadsheetId: SPREADSHEET_ID,
          updatedRange: "Products!B2",
          updatedRows: 1,
          updatedColumns: 1,
          updatedCells: 1,
        });
      }),
    );
    await sheetsUpdate(SPREADSHEET_ID, "Products!B2", [["Nasi Kuning"]], TOKEN);
    expect(capturedBody).toEqual({ values: [["Nasi Kuning"]] });
  });
});

describe("sheetsBatchGet", () => {
  it("fetches multiple ranges in one call", async () => {
    const result = await sheetsBatchGet(
      SPREADSHEET_ID,
      ["Products", "Categories"],
      TOKEN,
    );
    expect(result.valueRanges).toHaveLength(2);
  });
});

describe("retry on 429", () => {
  it("retries once on HTTP 429 after backoff", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/values/:range`, () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 429 });
        }
        return HttpResponse.json({
          range: "Products",
          majorDimension: "ROWS",
          values: FAKE_VALUES,
        });
      }),
    );
    const rows = await sheetsGet(SPREADSHEET_ID, "Products", TOKEN);
    expect(callCount).toBe(2);
    expect(rows).toHaveLength(2);
  });
});

describe("error handling", () => {
  it("throws SheetsApiError on HTTP 403 (forbidden)", async () => {
    server.use(
      http.get(
        `${BASE}/values/:range`,
        () => new HttpResponse("Forbidden", { status: 403 }),
      ),
    );
    await expect(sheetsGet(SPREADSHEET_ID, "Products", TOKEN)).rejects.toThrow(
      SheetsApiError,
    );
  });

  it("throws SheetsApiError on HTTP 404 (spreadsheet not found)", async () => {
    server.use(
      http.get(
        `${BASE}/values/:range`,
        () => new HttpResponse("Not Found", { status: 404 }),
      ),
    );
    await expect(sheetsGet(SPREADSHEET_ID, "Products", TOKEN)).rejects.toThrow(
      SheetsApiError,
    );
  });

  it("throws SheetsApiError after max retries exceeded", async () => {
    server.use(
      http.get(
        `${BASE}/values/:range`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );
    await expect(sheetsGet(SPREADSHEET_ID, "Products", TOKEN)).rejects.toThrow(
      SheetsApiError,
    );
  });

  it("throws if token is empty or undefined", async () => {
    await expect(sheetsGet(SPREADSHEET_ID, "Products", "")).rejects.toThrow(
      SheetsApiError,
    );
  });
});
