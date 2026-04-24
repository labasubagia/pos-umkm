/**
 * refund.service tests — covers T037 (Refund / Return Flow).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapters from "../../lib/adapters";
import { createRefund, fetchTransaction, RefundError } from "./refund.service";

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: "test-id",
    sheetName: "mock",
    getAll: vi.fn().mockResolvedValue([]),
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    batchUpsert: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockRepos = {
    categories: mockRepo(),
    products: mockRepo(),
    variants: mockRepo(),
    members: mockRepo(),
    customers: mockRepo(),
    settings: mockRepo(),
    stockLog: mockRepo(),
    purchaseOrders: mockRepo(),
    purchaseOrderItems: mockRepo(),
    transactions: mockRepo(),
    transactionItems: mockRepo(),
    refunds: mockRepo(),
    stores: mockRepo(),
    monthlySheets: mockRepo(),
    auditLog: mockRepo(),
  };
  vi.spyOn(adapters, "getRepos").mockReturnValue(
    mockRepos as ReturnType<typeof adapters.getRepos>,
  );
});

const TRANSACTION_ROW = {
  id: "tx-001",
  created_at: "2026-01-01T10:00:00.000Z",
  cashier_id: "user-1",
  customer_id: null,
  subtotal: 30000,
  discount_type: null,
  discount_value: 0,
  discount_amount: 0,
  tax: 0,
  total: 30000,
  payment_method: "CASH",
  cash_received: 50000,
  change: 20000,
  receipt_number: "INV/2026/001",
  notes: null,
};

const PRODUCT_ROW = {
  id: "prod-1",
  name: "Nasi Goreng",
  stock: 18,
  price: 15000,
  category_id: "cat-1",
  sku: "NASGOR",
  has_variants: false,
  created_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const REFUND_ITEM = {
  product_id: "prod-1",
  product_name: "Nasi Goreng",
  qty: 2,
  unit_price: 15000,
};

// ─── fetchTransaction ─────────────────────────────────────────────────────────

describe("fetchTransaction", () => {
  it("returns the transaction when found", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([TRANSACTION_ROW]);

    const tx = await fetchTransaction("tx-001");

    expect(tx.id).toBe("tx-001");
    expect(tx.total).toBe(30000);
  });

  it("throws RefundError when transaction not found", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([]);

    await expect(fetchTransaction("tx-999")).rejects.toThrow(RefundError);
  });
});

// ─── createRefund ─────────────────────────────────────────────────────────────

describe("createRefund", () => {
  it("appends row to Refunds tab", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([TRANSACTION_ROW]);
    mockRepos.products.getAll.mockResolvedValue([PRODUCT_ROW]);

    await createRefund("tx-001", [REFUND_ITEM], "Produk rusak");

    expect(mockRepos.refunds.batchInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        transaction_id: "tx-001",
        product_id: "prod-1",
        product_name: "Nasi Goreng",
        qty: 2,
        unit_price: 15000,
        reason: "Produk rusak",
      }),
    ]);
  });

  it("re-increments stock for each returned product", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([TRANSACTION_ROW]);
    mockRepos.products.getAll.mockResolvedValue([PRODUCT_ROW]);

    await createRefund("tx-001", [REFUND_ITEM], "Produk rusak");

    // Stock was 18, returning 2 → should be updated to 20
    expect(mockRepos.products.batchUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([{ id: "prod-1", stock: 20 }]),
    );
  });

  it("appends Audit_Log entry with event=REFUND", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([TRANSACTION_ROW]);
    mockRepos.products.getAll.mockResolvedValue([PRODUCT_ROW]);

    await createRefund("tx-001", [REFUND_ITEM], "Produk rusak");

    expect(mockRepos.auditLog.batchInsert).toHaveBeenCalledWith([
      expect.objectContaining({ event: "REFUND" }),
    ]);
    const auditRow = mockRepos.auditLog.batchInsert.mock.calls[0][0][0];
    const data = JSON.parse(auditRow.data as string);
    expect(data.transactionId).toBe("tx-001");
    expect(data.reason).toBe("Produk rusak");
  });

  it("throws RefundError if transaction not found", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([]);

    await expect(createRefund("tx-999", [REFUND_ITEM], "test")).rejects.toThrow(
      RefundError,
    );
  });

  it("throws RefundError if refund amount exceeds original transaction total", async () => {
    mockRepos.transactions.getAll.mockResolvedValue([TRANSACTION_ROW]);
    mockRepos.products.getAll.mockResolvedValue([PRODUCT_ROW]);

    // 3 items × 15000 = 45000 > 30000 (original total)
    const bigRefund = [{ ...REFUND_ITEM, qty: 3 }];
    await expect(createRefund("tx-001", bigRefund, "test")).rejects.toThrow(
      RefundError,
    );
  });
});
