import { createClient } from '@/lib/supabase/server'
import { Activity } from 'lucide-react'
import { formatInTimezone } from '@/lib/timezone'

export default async function ActivitiesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = user
    ? await supabase.from('profiles').select('timezone').eq('id', user.id).single()
    : { data: null }
  const userTz = userProfile?.timezone || 'America/New_York'

  const { data: activities } = await supabase
    .from('activities')
    .select('*, organizations(name), contacts(first_name, last_name)')
    .order('occurred_at', { ascending: false })
    .limit(50)

  // Fetch user names separately
  const userIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))]
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

  const activityIcons: Record<string, string> = {
    call: '📞', email: '✉️', meeting: '🤝', note: '📝', linkedin: '💼',
    text: '💬', site_visit: '🏗️', other: '📋',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-one70-black">Activity Feed</h1>
        <p className="text-one70-mid text-sm mt-1">Recent activity across all accounts</p>
      </div>

      <div className="bg-white rounded-lg border border-one70-border p-5">
        {activities && activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map(a => (
              <div key={a.id} className="flex gap-3 border-b border-one70-border pb-3 last:border-0">
                <span className="text-lg">{activityIcons[a.type] || '📋'}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <span className="text-sm font-medium text-one70-black capitalize">{a.type}</span>
                    {a.direction && <span className="text-xs text-one70-mid">({a.direction})</span>}
                    <span className="text-xs text-one70-mid">{formatInTimezone(a.occurred_at, userTz, { dateOnly: true })}</span>
                  </div>
                  {a.subject && <p className="text-sm font-medium text-one70-dark mt-0.5">{a.subject}</p>}
                  {a.body && <p className="text-sm text-one70-mid mt-0.5">{a.body}</p>}
                  <div className="flex flex-wrap gap-1 sm:gap-3 mt-1 text-xs text-one70-mid">
                    <span>by {nameMap.get(a.user_id) || 'Unknown'}</span>
                    {a.organizations && <span>| {(a.organizations as any).name}</span>}
                    {a.contacts && <span>| {(a.contacts as any).first_name} {(a.contacts as any).last_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-one70-mid">
            <Activity size={32} className="mx-auto mb-2 opacity-40" />
            <p>No activity logged yet</p>
            <p className="text-sm mt-1">Activities will appear here as your team logs calls, emails, and meetings</p>
          </div>
        )}
      </div>
    </div>
  )
}
