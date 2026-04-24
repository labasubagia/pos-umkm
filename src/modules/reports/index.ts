// Reports module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/reports', never from internal paths.

export { CashReconciliation } from "./CashReconciliation";
export { DailySummary } from "./DailySummary";
export { ExportError, exportToExcel, printReport } from "./export.service";
export { GrossProfitReport } from "./GrossProfitReport";
export type {
  DailySummary as DailySummaryData,
  ProfitSummary,
  ReportFilters,
  SummaryStats,
  TopProduct,
  TransactionItemRow,
  TransactionRow,
} from "./reports.service";
export {
  aggregateTransactions,
  calculateExpectedCash,
  calculateGrossProfit,
  fetchDailySummary,
  fetchTransactionsForRange,
  filterTransactions,
  ReportError,
  saveReconciliation,
} from "./reports.service";
export { SalesReport } from "./SalesReport";
