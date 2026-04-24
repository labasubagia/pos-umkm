// Customers module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/customers', never from internal paths.

export { CustomerSearch } from "./CustomerSearch";
export { CustomersListPage } from "./CustomersListPage";
export type { Customer } from "./customers.service";
export {
  addCustomer,
  CustomerError,
  fetchCustomers,
  updateCustomer,
} from "./customers.service";
export { RefundFlow } from "./RefundFlow";
export type { Refund, RefundItem } from "./refund.service";
export { createRefund, fetchTransaction, RefundError } from "./refund.service";
