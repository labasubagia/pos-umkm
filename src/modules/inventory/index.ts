// Inventory module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/inventory', never from internal paths.
export { StockOpname } from './StockOpname'
export { PurchaseOrders } from './PurchaseOrders'
export {
  fetchStockOpnameData,
  saveOpnameResults,
  createPurchaseOrder,
  receivePurchaseOrder,
  fetchPurchaseOrders,
  fetchPurchaseOrderItems,
  InventoryError,
} from './inventory.service'
export type {
  OpnameRow,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemRow,
} from './inventory.service'
