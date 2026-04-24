/**
 * InventoryPage — Stock opname and purchase order management.
 * Accessible to owner and manager roles.
 */

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { PurchaseOrders } from "../modules/inventory/PurchaseOrders";
import { StockOpname } from "../modules/inventory/StockOpname";

export default function InventoryPage() {
  return (
    <Tabs defaultValue="opname" className="gap-0">
      <TabsList variant="line" className="w-full mb-4">
        <TabsTrigger value="opname" data-testid="btn-tab-opname">
          Stok Opname
        </TabsTrigger>
        <TabsTrigger
          value="purchase-orders"
          data-testid="btn-tab-purchase-orders"
        >
          Purchase Order
        </TabsTrigger>
      </TabsList>
      <TabsContent value="opname">
        <StockOpname />
      </TabsContent>
      <TabsContent value="purchase-orders">
        <PurchaseOrders />
      </TabsContent>
    </Tabs>
  );
}
