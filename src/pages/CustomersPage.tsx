/**
 * CustomersPage.tsx — Page for Customer Management and Refund/Return Flow.
 *
 * Tab-based layout:
 *   - "Pelanggan" tab: CustomerSearch with a list of all customers
 *   - "Refund" tab: RefundFlow for processing returns
 *
 * Accessible to manager+ roles (enforced at router level via RoleRoute).
 */

import { useState } from 'react'
import { CustomerSearch } from '../modules/customers/CustomerSearch'
import { RefundFlow } from '../modules/customers/RefundFlow'
import type { Customer } from '../modules/customers/customers.service'

type Tab = 'customers' | 'refund'

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('customers')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Pelanggan & Refund</h1>

      {/* Tab navigation */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'customers'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('customers')}
          data-testid="tab-customers"
        >
          Pelanggan
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'refund'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('refund')}
          data-testid="tab-refund"
        >
          Refund / Retur
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'customers' && (
        <div className="space-y-4" data-testid="customers-tab-content">
          <div>
            <h2 className="mb-2 text-sm font-medium text-gray-700">Cari Pelanggan</h2>
            <CustomerSearch
              onSelect={(customer) => setSelectedCustomer(customer)}
            />
          </div>
          {selectedCustomer && (
            <div
              className="rounded-lg border border-blue-100 bg-blue-50 p-4"
              data-testid="selected-customer-info"
            >
              <p className="font-medium text-blue-800" data-testid="selected-customer-name">
                {selectedCustomer.name}
              </p>
              <p className="text-sm text-blue-600">{selectedCustomer.phone}</p>
              {selectedCustomer.email && (
                <p className="text-sm text-blue-500">{selectedCustomer.email}</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'refund' && (
        <div data-testid="refund-tab-content">
          <RefundFlow />
        </div>
      )}
    </div>
  )
}
