import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'
import { callClaude, PLAYBOOKS, buildContactContext, Vertical } from '@/lib/ai-utils'

export async function POST(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 10, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { dealId } = await request.json()
    if (!dealId) return NextResponse.json({ error: 'Deal ID required' }, { status: 400 })

    // Load deal with all related data
    const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    let contact = null, org = null, activities: any[] = [], tasks: any[] = []

    if (deal.contact_id) {
      const { data } = await supabase.from('contacts').select('*').eq('id', deal.contact_id).single()
      contact = data
    }
    if (deal.org_id) {
      const { data } = await supabase.from('organizations').select('*').eq('id', deal.org_id).single()
      org = data
    }

    // Get all activities on this deal
    const { data: dealActivities } = await supabase
      .from('activities')
      .select('*')
      .eq('deal_id', dealId)
      .order('occurred_at', { ascending: false })
      .limit(20)
    activities = dealActivities || []

    // Also get contact activities if linked
    if (deal.contact_id) {
      const { data: contactActivities } = await supabase
        .from('activities')
        .select('*')
        .eq('contact_id', deal.contact_id)
        .order('occurred_at', { ascending: false })
        .limit(10)
      if (contactActivities) {
        // Merge and dedupe
        const existingIds = new Set(activities.map(a => a.id))
        contactActivities.forEach(a => { if (!existingIds.has(a.id)) activities.push(a) })
        activities.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      }
    }

    // Get pending tasks
    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('deal_id', dealId)
      .eq('status', 'pending')
      .is('deleted_at', null)
    tasks = pendingTasks || []

    const vertical = (deal.vertical || org?.vertical || 'multifamily') as Vertical
    const playbook = PLAYBOOKS[vertical]

    // Verify at least one of contact/org/deal is present before building context
    if (!contact && !org && !deal) {
      return NextResponse.json({ error: 'Deal must have associated contact or organization' }, { status: 400 })
    }

    const crmContext = buildContactContext(contact, org, activities, deal)

    // Calculate deal health metrics
    const daysSinceLastActivity = activities.length > 0
      ? Math.floor((Date.now() - new Date(activities[0].occurred_at).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const totalActivities = activities.length
    const daysSinceCreated = Math.floor((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))

    const systemPrompt = `You are a deal coaching assistant for ONE70 Group, a commercial construction company. Analyze the deal data and provide actionable coaching.

COMPANY: ONE70 Group — ${playbook?.tagline || 'Commercial Construction'}
${playbook?.threeUniques ? `Three Uniques: Clear Cost (${playbook.threeUniques.clearCost}), Clear Schedule (${playbook.threeUniques.clearSchedule}), Ability to Scale (${playbook.threeUniques.abilityToScale})` : ''}

PIPELINE STAGES: Lead → Contacted → Discovery → Site Walk → Proposal → Negotiation → Won/Lost

OUTREACH CADENCE BEST PRACTICES:
- Cold open on Day 1, Follow-up #1 on Day 4, Follow-up #2 on Day 9, Break-up on Day 16
- After discovery: follow-up within 2 hours with recap + one-pager
- Propose concrete next steps: property walk, pilot project, portfolio planning call

${playbook?.painPoints ? `PAIN POINTS for ${playbook.vertical}:\n${playbook.painPoints.map(p => `- ${p}`).join('\n')}` : ''}`

    const userPrompt = `Analyze this deal and provide coaching.

${crmContext}

DEAL HEALTH METRICS:
- Days since last activity: ${daysSinceLastActivity !== null ? daysSinceLastActivity : 'No activities yet'}
- Total activities: ${totalActivities}
- Days in pipeline: ${daysSinceCreated}
- Current stage: ${deal.stage}
- Pending tasks: ${tasks.length}
${tasks.map(t => `  - ${t.title} (due: ${t.due_date || 'no date'})`).join('\n')}

Provide your analysis in this format:

DEAL HEALTH: [🟢 Healthy / 🟡 Needs Attention / 🔴 At Risk] — one sentence why

WHAT'S WORKING: 1-2 things going well (if any)

WHAT'S MISSING: Specific gaps in the deal progression

NEXT BEST ACTION: The single most important thing to do right now, with a specific recommendation (not generic advice). If a message should be sent, specify the channel and what to say. If a meeting should be scheduled, specify the type.

RECOMMENDED DEAL STAGE: Should the deal stage change? If so, to what and why?

Keep it direct and actionable. No fluff.`

    const coaching = await callClaude(systemPrompt, userPrompt, 1500)

    return NextResponse.json({ success: true, coaching })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
