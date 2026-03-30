import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Return defaults if no prefs exist yet
  if (!prefs) {
    return NextResponse.json({
      task_due_today: true,
      task_assigned: true,
      deal_stage_changed: true,
      deal_won: true,
      deal_lost: true,
      sequence_action_due: true,
      project_status_changed: true,
      daily_digest: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
    })
  }

  return NextResponse.json(prefs)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Only allow known preference fields
  const allowed = [
    'task_due_today', 'task_assigned', 'deal_stage_changed',
    'deal_won', 'deal_lost', 'sequence_action_due',
    'project_status_changed', 'daily_digest',
    'quiet_hours_start', 'quiet_hours_end',
  ]
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
