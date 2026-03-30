import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteUserForm from './invite-form'
import UserList from './user-list'
import PendingInvites from './pending-invites'

export default async function UserManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  const { data: invites } = await supabase
    .from('user_invites')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-one70-black">User Management</h1>
        <p className="text-one70-mid text-sm mt-1">Manage team access and roles</p>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Invite Team Member</h2>
        <InviteUserForm />
      </div>

      {/* Pending invites */}
      {invites && invites.length > 0 && (
        <PendingInvites invites={invites} />
      )}

      {/* Active users */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Team Members ({users?.length ?? 0})</h2>
        <UserList users={users || []} currentUserId={user.id} />
      </div>
    </div>
  )
}
