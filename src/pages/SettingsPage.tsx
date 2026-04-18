import { useState } from 'react'
import MemberManagement from '../modules/settings/MemberManagement'
import BusinessProfile from '../modules/settings/BusinessProfile'
import QRISConfig from '../modules/settings/QRISConfig'

type Tab = 'profile' | 'members' | 'qris'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profil Bisnis' },
  { id: 'members', label: 'Tim' },
  { id: 'qris', label: 'QRIS' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 border-b pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`btn-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'profile' && <BusinessProfile />}
        {activeTab === 'members' && <MemberManagement />}
        {activeTab === 'qris' && <QRISConfig />}
      </div>
    </div>
  )
}
