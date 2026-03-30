import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { sequence_id, contact_ids, deal_id } = await req.json()

  if (!sequence_id || !contact_ids?.length) {
    return NextResponse.json({ error: 'Missing sequence_id or contact_ids' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Get first step delay
  const { data: firstStep } = await supabase
    .from('sequence_steps')
    .select('delay_days')
    .eq('sequence_id', sequence_id)
    .eq('step_number', 1)
    .single()

  const firstActionDate = new Date()
  firstActionDate.setDate(firstActionDate.getDate() + (firstStep?.delay_days || 0))

  // Check for existing active enrollments to avoid duplicates
  const { data: existing } = await supabase
    .from('sequence_enrollments')
    .select('contact_id')
    .eq('sequence_id', sequence_id)
    .eq('status', 'active')
    .in('contact_id', contact_ids)

  const existingContactIds = new Set((existing || []).map(e => e.contact_id))
  const newContactIds = contact_ids.filter((id: string) => !existingContactIds.has(id))

  if (newContactIds.length === 0) {
    return NextResponse.json({ enrolled: 0, skipped: contact_ids.length, message: 'All contacts already enrolled' })
  }

  const { data: enrollments, error } = await supabase.from('sequence_enrollments').insert(
    newContactIds.map((contact_id: string) => ({
      sequence_id,
      contact_id,
      deal_id: deal_id || null,
      current_step: 1,
      status: 'active',
      enrolled_by: user.id,
      next_action_at: firstActionDate.toISOString(),
    }))
  ).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    enrolled: enrollments?.length || 0,
    skipped: contact_ids.length - newContactIds.length,
  })
}
