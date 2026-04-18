/**
 * InventoryPage — Stock opname and purchase order management.
 * Accessible to owner and manager roles.
 */
import { useState } from 'react'
import { StockOpname } from '../modules/inventory/StockOpname'
import { PurchaseOrders } from '../modules/inventory/PurchaseOrders'

type Tab = 'opname' | 'purchase-orders'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('opname')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'opname', label: 'Stok Opname' },
    { key: 'purchase-orders', label: 'Purchase Order' },
  ]

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">Inventori</h1>

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            data-testid={`btn-tab-${t.key}`}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'opname' && <StockOpname />}
      {activeTab === 'purchase-orders' && <PurchaseOrders />}
    </div>
  )
}
