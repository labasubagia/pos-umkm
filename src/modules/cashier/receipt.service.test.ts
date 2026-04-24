/**
 * receipt.service tests — T033.
 */
import { describe, expect, it } from "vitest";
import type { Transaction, TransactionItem } from "./cashier.service";
import {
  generateReceiptNumber,
  generateReceiptText,
  generateWhatsAppLink,
} from "./receipt.service";

const settings = {
  businessName: "Warung Pak Santoso",
  receiptFooter: "Terima kasih!",
  timezone: "Asia/Jakarta",
};

const transaction: Transaction = {
  id: "tx-1",
  created_at: "2026-04-18T05:30:00.000Z",
  cashier_id: "user-1",
  customer_id: null,
  subtotal: 35000,
  discount_type: "flat",
  discount_value: 0,
  discount_amount: 0,
  tax: 3850,
  total: 38850,
  payment_method: "CASH",
  cash_received: 50000,
  change: 11150,
  receipt_number: "INV/2026/001",
  notes: null,
};

const items: TransactionItem[] = [
  {
    id: "i1",
    transaction_id: "tx-1",
    product_id: "p1",
    variant_id: null,
    name: "Nasi Goreng",
    price: 15000,
    quantity: 2,
    subtotal: 30000,
  },
  {
    id: "i2",
    transaction_id: "tx-1",
    product_id: "p2",
    variant_id: null,
    name: "Es Teh Manis",
    price: 5000,
    quantity: 1,
    subtotal: 5000,
  },
];

describe("generateReceiptText", () => {
  it("includes business name in receipt", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("Warung Pak Santoso");
  });

  it("includes receipt number", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("INV/2026/001");
  });

  it("includes each line item with quantity and IDR price", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("Nasi Goreng");
    expect(text).toContain("2x");
    expect(text).toContain("Es Teh Manis");
  });

  it("includes total formatted as IDR", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("38.850"); // IDR format with period separator
  });

  it("includes cash received and change", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("50.000");
    expect(text).toContain("11.150");
  });

  it("includes footer message", () => {
    const text = generateReceiptText(transaction, items, settings);
    expect(text).toContain("Terima kasih!");
  });

  it("does not include kembalian line for QRIS transactions", () => {
    const qrisTx = {
      ...transaction,
      payment_method: "QRIS" as const,
      cash_received: 38850,
      change: 0,
    };
    const text = generateReceiptText(qrisTx, items, settings);
    expect(text).not.toContain("Kembalian");
  });

  it("includes discount line when discount_amount > 0", () => {
    const discountTx = {
      ...transaction,
      discount_type: "percent" as const,
      discount_value: 10,
      discount_amount: 3500,
    };
    const text = generateReceiptText(discountTx, items, settings);
    expect(text).toContain("Diskon");
    expect(text).toContain("10%");
  });
});

describe("generateWhatsAppLink", () => {
  it("generates wa.me URL with phone number and receipt text", () => {
    const link = generateWhatsAppLink("08123456789", "Test receipt");
    expect(link).toContain("wa.me/628123456789");
    expect(link).toContain(encodeURIComponent("Test receipt"));
  });

  it("generates wa.me URL without phone number for open contact picker", () => {
    const link = generateWhatsAppLink("", "Test receipt");
    expect(link).toContain("wa.me/?text=");
    expect(link).not.toContain("628123456789");
  });

  it("throws for invalid phone number", () => {
    expect(() => generateWhatsAppLink("not-a-phone", "text")).toThrow();
  });
});

describe("generateReceiptNumber", () => {
  it("generates INV/YYYY/NNN format", () => {
    const num = generateReceiptNumber("INV/2026", 1);
    expect(num).toBe("INV/2026/001");
  });

  it("pads sequence number to 3 digits", () => {
    expect(generateReceiptNumber("INV/2026", 42)).toBe("INV/2026/042");
  });
});
