import { useState } from 'react'
import { DailySummary } from '../modules/reports/DailySummary'
import { SalesReport } from '../modules/reports/SalesReport'
import { GrossProfitReport } from '../modules/reports/GrossProfitReport'
import { CashReconciliation } from '../modules/reports/CashReconciliation'

type Tab = 'daily' | 'sales' | 'profit' | 'reconciliation'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('daily')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'daily', label: 'Ringkasan Harian' },
    { id: 'sales', label: 'Laporan Penjualan' },
    { id: 'profit', label: 'Laba Kotor' },
    { id: 'reconciliation', label: 'Rekonsiliasi Kas' },
  ]

  return (
    <div data-testid="reports-page">
      <div data-testid="reports-tabs" className="flex gap-2 border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 ${activeTab === tab.id ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div data-testid="reports-content">
        {activeTab === 'daily' && <DailySummary />}
        {activeTab === 'sales' && <SalesReport />}
        {activeTab === 'profit' && <GrossProfitReport />}
        {activeTab === 'reconciliation' && <CashReconciliation />}
      </div>
    </div>
  )
}
