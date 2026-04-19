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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  return (
    <Tabs defaultValue="customers" className="gap-0">
      <TabsList variant="line" className="w-full mb-4">
        <TabsTrigger value="customers" data-testid="tab-customers">Pelanggan</TabsTrigger>
        <TabsTrigger value="refund" data-testid="tab-refund">Refund / Retur</TabsTrigger>
      </TabsList>

      <TabsContent value="customers">
        <div className="space-y-4" data-testid="customers-tab-content">
          <CustomerSearch
            onSelect={(customer) => setSelectedCustomer(customer)}
          />
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
      </TabsContent>

      <TabsContent value="refund">
        <div data-testid="refund-tab-content">
          <RefundFlow />
        </div>
      </TabsContent>
    </Tabs>
  )
}
