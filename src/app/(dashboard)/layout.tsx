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
      <div className="sidebar-container">
        <Sidebar userRole={profile.role} userName={profile.full_name} />
      </div>
      <main className="main-with-sidebar lg:ml-64 min-h-screen lg:pt-0">
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
