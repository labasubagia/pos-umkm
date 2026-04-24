/**
 * CustomersListPage — Customer list page (route: customers).
 *
 * The refund sub-page lives at customers/refund (router → RefundFlow directly).
 * Navigation between sub-sections is handled by the NavBar sub-nav row.
 */

import { useState } from "react";
import { CustomerSearch } from "./CustomerSearch";
import type { Customer } from "./customers.service";

export function CustomersListPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  return (
    <div className="space-y-4" data-testid="customers-tab-content">
      <CustomerSearch onSelect={(customer) => setSelectedCustomer(customer)} />
      {selectedCustomer && (
        <div
          className="rounded-lg border border-blue-100 bg-blue-50 p-4"
          data-testid="selected-customer-info"
        >
          <p
            className="font-medium text-blue-800"
            data-testid="selected-customer-name"
          >
            {selectedCustomer.name}
          </p>
          <p className="text-sm text-blue-600">{selectedCustomer.phone}</p>
          {selectedCustomer.email && (
            <p className="text-sm text-blue-500">{selectedCustomer.email}</p>
          )}
        </div>
      )}
    </div>
  );
}
