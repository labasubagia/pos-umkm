// Reports module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/reports', never from internal paths.

export type {
  TransactionRow,
  TransactionItemRow,
  TopProduct,
  SummaryStats,
  DailySummary as DailySummaryData,
  ReportFilters,
  ProfitSummary,
} from "./reports.service";
export {
  ReportError,
  aggregateTransactions,
  fetchDailySummary,
  fetchTransactionsForRange,
  filterTransactions,
  calculateGrossProfit,
  calculateExpectedCash,
  saveReconciliation,
} from "./reports.service";
export { ExportError, exportToExcel, printReport } from "./export.service";
export { DailySummary } from "./DailySummary";
export { SalesReport } from "./SalesReport";
export { GrossProfitReport } from "./GrossProfitReport";
export { CashReconciliation } from "./CashReconciliation";
