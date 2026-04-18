/**
 * InventoryPage — Stock opname and purchase order management.
 * Accessible to owner and manager roles.
 */
import { StockOpname } from '../modules/inventory/StockOpname'
import { PurchaseOrders } from '../modules/inventory/PurchaseOrders'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">Inventori</h1>

      <Tabs defaultValue="opname">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="opname" data-testid="btn-tab-opname">Stok Opname</TabsTrigger>
          <TabsTrigger value="purchase-orders" data-testid="btn-tab-purchase-orders">Purchase Order</TabsTrigger>
        </TabsList>
        <TabsContent value="opname"><StockOpname /></TabsContent>
        <TabsContent value="purchase-orders"><PurchaseOrders /></TabsContent>
      </Tabs>
    </div>
  )
}
