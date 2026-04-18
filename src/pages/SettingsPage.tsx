import MemberManagement from '../modules/settings/MemberManagement'
import BusinessProfile from '../modules/settings/BusinessProfile'
import QRISConfig from '../modules/settings/QRISConfig'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function SettingsPage() {
  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger value="profile" data-testid="btn-tab-profile">Profil Bisnis</TabsTrigger>
          <TabsTrigger value="members" data-testid="btn-tab-members">Tim</TabsTrigger>
          <TabsTrigger value="qris" data-testid="btn-tab-qris">QRIS</TabsTrigger>
        </TabsList>
        <div className="pt-4">
          <TabsContent value="profile"><BusinessProfile /></TabsContent>
          <TabsContent value="members"><MemberManagement /></TabsContent>
          <TabsContent value="qris"><QRISConfig /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
