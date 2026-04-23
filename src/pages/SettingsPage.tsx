import MemberManagement from '../modules/settings/MemberManagement'
import BusinessProfile from '../modules/settings/BusinessProfile'
import QRISConfig from '../modules/settings/QRISConfig'
import StoreManagementPage from './StoreManagementPage'
import OutboxPage from './OutboxPage'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function SettingsPage() {
  return (
    <Tabs defaultValue="profile" className="gap-0">
      <TabsList variant="line" className="w-full mb-4">
        <TabsTrigger value="profile" data-testid="btn-tab-profile">Profil Bisnis</TabsTrigger>
        <TabsTrigger value="members" data-testid="btn-tab-members">Tim</TabsTrigger>
        <TabsTrigger value="qris" data-testid="btn-tab-qris">QRIS</TabsTrigger>
        <TabsTrigger value="stores" data-testid="btn-tab-stores">Toko</TabsTrigger>
        <TabsTrigger value="outbox" data-testid="btn-tab-outbox">Outbox</TabsTrigger>
      </TabsList>
      <TabsContent value="profile"><BusinessProfile /></TabsContent>
      <TabsContent value="members"><MemberManagement /></TabsContent>
      <TabsContent value="qris"><QRISConfig /></TabsContent>
      <TabsContent value="stores"><StoreManagementPage /></TabsContent>
      <TabsContent value="outbox"><OutboxPage /></TabsContent>
    </Tabs>
  )
}
