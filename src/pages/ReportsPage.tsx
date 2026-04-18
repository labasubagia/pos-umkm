import { DailySummary } from '../modules/reports/DailySummary'
import { SalesReport } from '../modules/reports/SalesReport'
import { GrossProfitReport } from '../modules/reports/GrossProfitReport'
import { CashReconciliation } from '../modules/reports/CashReconciliation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function ReportsPage() {
  return (
    <div data-testid="reports-page">
      <Tabs defaultValue="daily">
        <div data-testid="reports-tabs">
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="daily" data-testid="tab-daily">Ringkasan Harian</TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">Laporan Penjualan</TabsTrigger>
            <TabsTrigger value="profit" data-testid="tab-profit">Laba Kotor</TabsTrigger>
            <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">Rekonsiliasi Kas</TabsTrigger>
          </TabsList>
        </div>
        <div data-testid="reports-content">
          <TabsContent value="daily"><DailySummary /></TabsContent>
          <TabsContent value="sales"><SalesReport /></TabsContent>
          <TabsContent value="profit"><GrossProfitReport /></TabsContent>
          <TabsContent value="reconciliation"><CashReconciliation /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
