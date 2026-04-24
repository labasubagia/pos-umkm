// Inventory module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/inventory', never from internal paths.

export type {
  OpnameRow,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemRow,
} from "./inventory.service";
export {
  createPurchaseOrder,
  fetchPurchaseOrderItems,
  fetchPurchaseOrders,
  fetchStockOpnameData,
  InventoryError,
  receivePurchaseOrder,
  saveOpnameResults,
} from "./inventory.service";
export { PurchaseOrders } from "./PurchaseOrders";
export { StockOpname } from "./StockOpname";
