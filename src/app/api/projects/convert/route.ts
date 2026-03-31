import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { deal_id } = await req.json()

  if (!deal_id) return NextResponse.json({ error: 'Missing deal_id' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: deal } = await supabase
    .from('deals')
    .select('*, organizations(name), properties(name)')
    .eq('id', deal_id)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Check if project already exists for this deal
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('deal_id', deal_id)
    .is('deleted_at', null)
    .single()

  if (existing) return NextResponse.json({ error: 'Project already exists for this deal', project_id: existing.id }, { status: 409 })

  const projectName = deal.properties?.name
    ? `${deal.organizations?.name || 'Project'} — ${deal.properties.name}`
    : deal.name

  // Get first project stage from DB, fallback to 'scoping'
  let firstStage = 'scoping'
  const { data: stageData } = await supabase.from('project_stages').select('name').order('sort_order').limit(1)
  if (stageData?.[0]) firstStage = stageData[0].name

  const { data: project, error } = await supabase.from('projects').insert({
    name: projectName,
    deal_id: deal.id,
    org_id: deal.org_id,
    property_id: deal.property_id,
    contact_id: deal.contact_id,
    assigned_to: deal.assigned_to,
    vertical: deal.vertical,
    status: firstStage,
    contract_value: deal.value,
    scope_description: deal.services_offered,
    notes: deal.notes,
    created_by: user.id,
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

  // Log activity
  await supabase.from('activities').insert({
    type: 'note',
    subject: 'Deal converted to project',
    body: `Deal "${deal.name}" was converted to a project.`,
    org_id: deal.org_id,
    contact_id: deal.contact_id,
    deal_id: deal.id,
    user_id: user.id,
  })

  return NextResponse.json({ project_id: project.id })
}
