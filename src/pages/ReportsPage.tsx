import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { CashReconciliation } from "../modules/reports/CashReconciliation";
import { DailySummary } from "../modules/reports/DailySummary";
import { GrossProfitReport } from "../modules/reports/GrossProfitReport";
import { SalesReport } from "../modules/reports/SalesReport";

export default function ReportsPage() {
  return (
    <Tabs defaultValue="daily" className="gap-0" data-testid="reports-page">
      <TabsList variant="line" className="w-full mb-4">
        <TabsTrigger value="daily" data-testid="tab-daily">
          Harian
        </TabsTrigger>
        <TabsTrigger value="sales" data-testid="tab-sales">
          Penjualan
        </TabsTrigger>
        <TabsTrigger value="profit" data-testid="tab-profit">
          Laba Kotor
        </TabsTrigger>
        <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">
          Rekonsiliasi
        </TabsTrigger>
      </TabsList>
      <TabsContent value="daily">
        <DailySummary />
      </TabsContent>
      <TabsContent value="sales">
        <SalesReport />
      </TabsContent>
      <TabsContent value="profit">
        <GrossProfitReport />
      </TabsContent>
      <TabsContent value="reconciliation">
        <CashReconciliation />
      </TabsContent>
    </Tabs>
  );
}
