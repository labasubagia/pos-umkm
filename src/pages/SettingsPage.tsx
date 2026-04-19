import MemberManagement from '../modules/settings/MemberManagement'
import BusinessProfile from '../modules/settings/BusinessProfile'
import QRISConfig from '../modules/settings/QRISConfig'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Tabs defaultValue="profile" className="gap-0">
        <div className="overflow-x-auto mb-4">
          <TabsList variant="line" className="min-w-full">
            <TabsTrigger value="profile" data-testid="btn-tab-profile">Profil Bisnis</TabsTrigger>
            <TabsTrigger value="members" data-testid="btn-tab-members">Tim</TabsTrigger>
            <TabsTrigger value="qris" data-testid="btn-tab-qris">QRIS</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="profile"><BusinessProfile /></TabsContent>
        <TabsContent value="members"><MemberManagement /></TabsContent>
        <TabsContent value="qris"><QRISConfig /></TabsContent>
      </Tabs>
    </div>
  )
}
