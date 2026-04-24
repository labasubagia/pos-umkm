/**
 * receipt.service.ts — WhatsApp receipt generation (T033).
 *
 * Receipts are plain text formatted for WhatsApp (wa.me pre-fill link).
 * No thermal printing in MVP — that is post-MVP.
 *
 * Receipt format (Bahasa Indonesia):
 *   Business name + address line
 *   ─────────────────
 *   No: INV/2026/001  Tgl: 18/04/2026 12:30
 *   ─────────────────
 *   2x Nasi Goreng        Rp 30.000
 *   1x Es Teh Manis       Rp  5.000
 *   ─────────────────
 *   Subtotal              Rp 35.000
 *   Diskon (10%)         -Rp  3.500
 *   PPN (11%)             Rp  3.465
 *   ─────────────────
 *   TOTAL                 Rp 34.965
 *   Tunai                 Rp 50.000
 *   Kembalian             Rp 15.035
 *   ─────────────────
 *   Terima kasih!
 */

import { formatDateTime, formatIDR } from "../../lib/formatters";
import { validatePhone } from "../../lib/validators";
import type { Transaction, TransactionItem } from "./cashier.service";

const DIVIDER = "─────────────────────";

export interface ReceiptSettings {
  businessName: string;
  receiptFooter?: string;
  timezone: string;
}

/**
 * Generates a plain text receipt string suitable for WhatsApp sharing.
 * All monetary values are formatted in IDR.
 */
export function generateReceiptText(
  transaction: Transaction,
  items: TransactionItem[],
  settings: ReceiptSettings,
): string {
  const lines: string[] = [];
  const tz = settings.timezone || "Asia/Jakarta";

  lines.push(`🏪 *${settings.businessName}*`);
  lines.push(DIVIDER);
  lines.push(`No: ${transaction.receipt_number}`);
  lines.push(`Tgl: ${formatDateTime(transaction.created_at, tz)}`);
  lines.push(DIVIDER);

  // Line items
  for (const item of items) {
    const lineTotal = formatIDR(item.price * item.quantity);
    lines.push(`${item.quantity}x ${item.name}  ${lineTotal}`);
  }

  lines.push(DIVIDER);
  lines.push(`Subtotal       ${formatIDR(transaction.subtotal)}`);

  if (transaction.discount_amount > 0) {
    const discLabel =
      transaction.discount_type === "percent"
        ? `Diskon (${transaction.discount_value}%)`
        : "Diskon";
    lines.push(`${discLabel}    -${formatIDR(transaction.discount_amount)}`);
  }

  if (transaction.tax > 0) {
    lines.push(`PPN            ${formatIDR(transaction.tax)}`);
  }

  lines.push(DIVIDER);
  lines.push(`*TOTAL         ${formatIDR(transaction.total)}*`);

  const methodLabel: Record<string, string> = {
    CASH: "Tunai",
    QRIS: "QRIS",
    SPLIT: "Bayar Split",
  };
  lines.push(
    `${methodLabel[transaction.payment_method] ?? transaction.payment_method}  ${formatIDR(transaction.cash_received)}`,
  );

  if (
    transaction.payment_method === "CASH" ||
    transaction.payment_method === "SPLIT"
  ) {
    lines.push(`Kembalian      ${formatIDR(transaction.change)}`);
  }

  lines.push(DIVIDER);
  lines.push(settings.receiptFooter ?? "Terima kasih sudah berbelanja! 🙏");

  return lines.join("\n");
}

/**
 * Generates a wa.me pre-fill URL so the cashier can tap to open WhatsApp
 * with the receipt text already typed.
 *
 * phoneNumber may be empty — wa.me without a number opens the WhatsApp
 * contact picker, which is fine for the MVP use case.
 *
 * Throws if phoneNumber is provided but is not a valid Indonesian number.
 */
export function generateWhatsAppLink(
  phoneNumber: string,
  receiptText: string,
): string {
  if (phoneNumber) {
    const validation = validatePhone(phoneNumber);
    if (!validation.valid) {
      throw new Error(`Nomor WhatsApp tidak valid: ${validation.error}`);
    }
    // Normalize: strip leading 0, ensure starts with 62
    const normalized = phoneNumber.startsWith("0")
      ? `62${phoneNumber.slice(1)}`
      : phoneNumber.replace(/^\+/, "");
    return `https://wa.me/${normalized}?text=${encodeURIComponent(receiptText)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(receiptText)}`;
}

/**
 * Generates a receipt number in the format INV/YYYY/NNN.
 * Sequence is zero-padded to 3 digits.
 */
export function generateReceiptNumber(
  prefix: string,
  sequence: number,
): string {
  const padded = String(sequence).padStart(3, "0");
  return `${prefix}/${padded}`;
}
