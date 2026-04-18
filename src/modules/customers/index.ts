// Customers module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/customers', never from internal paths.

export type { Customer } from './customers.service'
export { CustomerError, fetchCustomers, addCustomer, updateCustomer } from './customers.service'
export { CustomerSearch } from './CustomerSearch'

export type { RefundItem, Refund } from './refund.service'
export { RefundError, fetchTransaction, createRefund } from './refund.service'
export { RefundFlow } from './RefundFlow'
