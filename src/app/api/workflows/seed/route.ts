import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_WORKFLOWS = [
  {
    name: 'Deal Won → Create Project + Notify Team',
    trigger_type: 'deal_won',
    trigger_config: {},
    actions: [
      { action_order: 1, action_type: 'create_project', action_config: {} },
      { action_order: 2, action_type: 'notify_team', action_config: { message: 'New project created from won deal. Time to start scoping.' } },
      { action_order: 3, action_type: 'create_task', action_config: { title: 'Schedule kickoff meeting with client', task_type: 'follow_up', priority: 'high', due_in_days: 3 } },
    ],
  },
  {
    name: 'Deal Lost → Create Follow-up Task',
    trigger_type: 'deal_lost',
    trigger_config: {},
    actions: [
      { action_order: 1, action_type: 'create_task', action_config: { title: 'Send loss debrief email and schedule 90-day check-in', task_type: 'follow_up', priority: 'low', due_in_days: 7 } },
      { action_order: 2, action_type: 'notify_team', action_config: { message: 'Deal was lost. Follow-up task created for debrief.' } },
    ],
  },
]

export async function POST() {
  const supabase = await createClient()

  // Admin-only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let created = 0
  for (const wf of DEFAULT_WORKFLOWS) {
    const { data: existing } = await supabase.from('workflows')
      .select('id').eq('name', wf.name).is('deleted_at', null).single()
    if (existing) continue

    const { data: newWf, error } = await supabase.from('workflows').insert({
      name: wf.name, trigger_type: wf.trigger_type, trigger_config: wf.trigger_config, is_active: true,
    }).select('id').single()

    if (error || !newWf) continue

    await supabase.from('workflow_actions').insert(
      wf.actions.map(a => ({ workflow_id: newWf.id, ...a }))
    )
    created++
  }

  return NextResponse.redirect(new URL('/settings/integrations', process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'))
}
