import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import QuickAddContact from '@/components/quick-add-contact'
import EnableBiometricPrompt from '@/components/enable-biometric'
import TeamsInit from '@/components/teams-init'
import PushNotificationInit from '@/components/push-notification-init'
import AiAssistant from '@/components/ai-assistant'
import ShareReceiver from '@/components/share-receiver'
import TimezoneSync from '@/components/timezone-sync'
import Providers from '@/components/providers'
import BottomTabBar from '@/components/bottom-tab-bar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <Providers>
    <div className="min-h-screen bg-one70-gray">
      <TeamsInit />
      {/* Migration banner */}
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black px-4 py-3 text-center shadow-md">
        <p className="text-sm font-bold">
          This platform has been retired. All data has been migrated to the new platform and will not be synced moving forward.
        </p>
        <p className="text-xs mt-0.5">
          Contact Ben Diamond for any access issues to the new platform.
        </p>
      </div>
      <div className="sidebar-container pt-[68px]">
        <Sidebar userRole={profile.role} userName={profile.full_name} />
      </div>
      <main className="main-with-sidebar lg:ml-64 min-h-screen lg:pt-0 pt-[68px]">
        <div className="px-3 pt-1 pb-20 lg:px-6 lg:pt-6 lg:pb-6">
          {children}
        </div>
      </main>
      <BottomTabBar isAdmin={profile.role === 'admin'} />
      {profile.role !== 'viewer' && <QuickAddContact />}
      {profile.role !== 'viewer' && <AiAssistant userName={profile.full_name} />}
      <EnableBiometricPrompt userEmail={user.email || ''} />
      <PushNotificationInit />
      <ShareReceiver />
      <TimezoneSync />
    </div>
    </Providers>
  )
}
