import { createClient } from '@/lib/supabase/server'
import OutreachQueue from './outreach-queue'

export default async function OutreachPage() {
  const supabase = await createClient()

  // Get active enrollments with next_action_at <= now + 1 day (today and overdue)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: dueEnrollments } = await supabase
    .from('sequence_enrollments')
    .select(`
      *,
      contacts(id, first_name, last_name, email, phone, linkedin_url, org_id,
        organizations:org_id(id, name)),
      sequences(id, name, vertical),
      deals(id, name)
    `)
    .eq('status', 'active')
    .lte('next_action_at', tomorrow)
    .order('next_action_at')

  // Get steps for each enrollment's current step
  const enrollmentIds = (dueEnrollments || []).map(e => e.sequence_id)
  const { data: allSteps } = await supabase
    .from('sequence_steps')
    .select('*')
    .in('sequence_id', [...new Set(enrollmentIds)])
    .order('step_number')

  const stepsMap = new Map<string, any[]>()
  allSteps?.forEach(s => {
    if (!stepsMap.has(s.sequence_id)) stepsMap.set(s.sequence_id, [])
    stepsMap.get(s.sequence_id)!.push(s)
  })

  // Get upcoming (next 7 days)
  const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: upcomingEnrollments } = await supabase
    .from('sequence_enrollments')
    .select(`
      *,
      contacts(id, first_name, last_name, email,
        organizations:org_id(name)),
      sequences(id, name, vertical)
    `)
    .eq('status', 'active')
    .gt('next_action_at', tomorrow)
    .lte('next_action_at', weekOut)
    .order('next_action_at')

  // Get reps
  const { data: reps } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
  const nameMap = Object.fromEntries((reps || []).map(r => [r.id, r.full_name]))

  const enrichedDue = (dueEnrollments || []).map(e => {
    const seqSteps = stepsMap.get(e.sequence_id) || []
    const currentStep = seqSteps.find((s: any) => s.step_number === e.current_step)
    return { ...e, currentStep, totalSteps: seqSteps.length }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-one70-black">Outreach Queue</h1>
        <p className="text-one70-mid text-sm mt-1">Sequence actions due today and upcoming this week</p>
      </div>
      <OutreachQueue
        dueItems={enrichedDue}
        upcomingItems={upcomingEnrollments || []}
        nameMap={nameMap}
      />
    </div>
  )
}
