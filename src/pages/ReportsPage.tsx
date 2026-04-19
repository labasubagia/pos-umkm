import { DailySummary } from '../modules/reports/DailySummary'
import { SalesReport } from '../modules/reports/SalesReport'
import { GrossProfitReport } from '../modules/reports/GrossProfitReport'
import { CashReconciliation } from '../modules/reports/CashReconciliation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6" data-testid="reports-page">
      <Tabs defaultValue="daily" className="gap-0">
        <div className="overflow-x-auto mb-4">
          <TabsList variant="line" className="min-w-full">
            <TabsTrigger value="daily" data-testid="tab-daily">Harian</TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">Penjualan</TabsTrigger>
            <TabsTrigger value="profit" data-testid="tab-profit">Laba Kotor</TabsTrigger>
            <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">Rekonsiliasi</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="daily"><DailySummary /></TabsContent>
        <TabsContent value="sales"><SalesReport /></TabsContent>
        <TabsContent value="profit"><GrossProfitReport /></TabsContent>
        <TabsContent value="reconciliation"><CashReconciliation /></TabsContent>
      </Tabs>
    </div>
  )
}
