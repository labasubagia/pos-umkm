/**
 * InventoryPage — Stock opname and purchase order management.
 * Accessible to owner and manager roles.
 */
import { StockOpname } from '../modules/inventory/StockOpname'
import { PurchaseOrders } from '../modules/inventory/PurchaseOrders'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Tabs defaultValue="opname" className="gap-0">
        <div className="overflow-x-auto mb-4">
          <TabsList variant="line" className="min-w-full">
            <TabsTrigger value="opname" data-testid="btn-tab-opname">Stok Opname</TabsTrigger>
            <TabsTrigger value="purchase-orders" data-testid="btn-tab-purchase-orders">Purchase Order</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="opname"><StockOpname /></TabsContent>
        <TabsContent value="purchase-orders"><PurchaseOrders /></TabsContent>
      </Tabs>
    </div>
  )
}
