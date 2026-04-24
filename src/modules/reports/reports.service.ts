import { getRepos } from "../../lib/adapters";
import { nowUTC } from "../../lib/formatters";

export interface TransactionRow {
  id: string;
  receipt_number: string;
  created_at: string;
  cashier_id: string;
  payment_method: string;
  total: number;
  cash_received: number;
}

export interface TransactionItemRow {
  id: string;
  transaction_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  total_qty: number;
  total_revenue: number;
}

export interface SummaryStats {
  total_revenue: number;
  transaction_count: number;
  average_basket: number;
  top_products: TopProduct[];
}

export interface DailySummary extends SummaryStats {
  date: string;
}

export interface ReportFilters {
  cashier_email?: string;
  payment_method?: "CASH" | "QRIS" | "SPLIT";
}

export interface ProfitSummary {
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  margin_percent: number;
}

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

// ─── T038 — Daily Sales Summary ───────────────────────────────────────────────

export function aggregateTransactions(
  transactions: TransactionRow[],
  items: TransactionItemRow[],
  date: string,
): SummaryStats {
  const dayTxs = transactions.filter((t) => t.created_at.startsWith(date));
  const txIds = new Set(dayTxs.map((t) => t.id));

  const total_revenue = dayTxs.reduce((sum, t) => sum + t.total, 0);
  const transaction_count = dayTxs.length;
  const average_basket =
    transaction_count === 0 ? 0 : total_revenue / transaction_count;

  const dayItems = items.filter((i) => txIds.has(i.transaction_id));
  const productMap = new Map<string, TopProduct>();
  for (const item of dayItems) {
    const existing = productMap.get(item.product_id);
    if (existing) {
      existing.total_qty += item.quantity;
      existing.total_revenue += item.subtotal;
    } else {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        name: item.name,
        total_qty: item.quantity,
        total_revenue: item.subtotal,
      });
    }
  }

  const top_products = Array.from(productMap.values())
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 5);

  return { total_revenue, transaction_count, average_basket, top_products };
}

export async function fetchDailySummary(date: string): Promise<DailySummary> {
  const [txRows, itemRows] = await Promise.all([
    getRepos().transactions.getAll(),
    getRepos().transactionItems.getAll(),
  ]);

  if (txRows.length === 0) {
    throw new ReportError("Belum ada data transaksi untuk bulan ini");
  }

  const transactions = txRows.map((r) => ({
    id: String(r.id),
    receipt_number: String(r.receipt_number ?? ""),
    created_at: String(r.created_at),
    cashier_id: String(r.cashier_id),
    payment_method: String(r.payment_method),
    total: Number(r.total),
    cash_received: Number(r.cash_received),
  })) as TransactionRow[];

  const items = itemRows.map((r) => ({
    id: String(r.id),
    transaction_id: String(r.transaction_id),
    product_id: String(r.product_id),
    name: String(r.name),
    price: Number(r.price),
    quantity: Number(r.quantity),
    subtotal: Number(r.subtotal),
  })) as TransactionItemRow[];

  return { date, ...aggregateTransactions(transactions, items, date) };
}

// ─── T039 — Date-Range Sales Report ──────────────────────────────────────────

function getMonthsInRange(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export async function fetchTransactionsForRange(
  startDate: string,
  endDate: string,
): Promise<TransactionRow[]> {
  if (startDate > endDate) {
    throw new ReportError("Tanggal mulai tidak boleh lebih dari tanggal akhir");
  }

  const months = getMonthsInRange(startDate, endDate);
  const endBound = `${endDate}T23:59:59.999Z`;

  const allRows: TransactionRow[] = [];
  const seen = new Set<string>();

  for (const _month of months) {
    const rows = await getRepos().transactions.getAll();
    for (const r of rows) {
      const id = String(r.id);
      const created_at = String(r.created_at);
      if (seen.has(id)) continue;
      if (created_at >= startDate && created_at <= endBound) {
        seen.add(id);
        allRows.push({
          id,
          receipt_number: String(r.receipt_number ?? ""),
          created_at,
          cashier_id: String(r.cashier_id),
          payment_method: String(r.payment_method),
          total: Number(r.total),
          cash_received: Number(r.cash_received),
        });
      }
    }
  }

  return allRows;
}

export function filterTransactions(
  transactions: TransactionRow[],
  filters: ReportFilters,
): TransactionRow[] {
  let result = transactions;
  if (filters.cashier_email) {
    result = result.filter((t) => t.cashier_id === filters.cashier_email);
  }
  if (filters.payment_method) {
    result = result.filter((t) => t.payment_method === filters.payment_method);
  }
  return result;
}

// ─── T040 — Gross Profit Report ───────────────────────────────────────────────

export function calculateGrossProfit(
  transactions: TransactionRow[],
  items: TransactionItemRow[],
  products: Array<{ id: string; cost_price: number }>,
): ProfitSummary {
  const txIds = new Set(transactions.map((t) => t.id));
  const productMap = new Map(products.map((p) => [p.id, p.cost_price]));

  let total_revenue = 0;
  let total_cost = 0;

  for (const item of items) {
    if (!txIds.has(item.transaction_id)) continue;
    total_revenue += item.price * item.quantity;
    const cost_price = productMap.get(item.product_id) ?? 0;
    total_cost += cost_price * item.quantity;
  }

  const gross_profit = total_revenue - total_cost;
  const margin_percent =
    total_revenue === 0
      ? 0
      : Math.round((gross_profit / total_revenue) * 1000) / 10;

  return { total_revenue, total_cost, gross_profit, margin_percent };
}

// ─── T041 — Cash Reconciliation ───────────────────────────────────────────────

export function calculateExpectedCash(
  openingBalance: number,
  transactions: TransactionRow[],
  refunds: Array<{ amount: number; payment_method: string }>,
): number {
  let expected = openingBalance;

  for (const tx of transactions) {
    if (tx.payment_method === "CASH") {
      expected += tx.total;
    } else if (tx.payment_method === "SPLIT") {
      expected += tx.cash_received;
    }
  }

  for (const refund of refunds) {
    if (refund.payment_method === "CASH") {
      expected -= refund.amount;
    }
  }

  return expected;
}

export async function saveReconciliation(
  expected: number,
  actual: number,
  date: string,
): Promise<void> {
  if (actual < 0) {
    throw new ReportError("Saldo penutup tidak boleh negatif");
  }
  const surplus_deficit = actual - expected;
  await getRepos().auditLog.batchInsert([
    {
      event: "CASH_RECONCILIATION",
      data: JSON.stringify({ expected, actual, surplus_deficit, date }),
      created_at: nowUTC(),
    },
  ]);
}
