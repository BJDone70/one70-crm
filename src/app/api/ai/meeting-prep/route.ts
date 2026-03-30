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

    const { contactId, orgId, dealId } = await request.json()

    let contact = null, org = null, deal = null, activities: any[] = [], properties: any[] = [], keyNotes: any[] = []

    if (contactId) {
      const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single()
      contact = data
    }
    if (orgId) {
      const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single()
      org = data
    }
    if (dealId) {
      const { data } = await supabase.from('deals').select('*').eq('id', dealId).single()
      deal = data
    }

    // Get all activities for this contact/org
    const actQuery = contactId
      ? supabase.from('activities').select('*').eq('contact_id', contactId).order('occurred_at', { ascending: false }).limit(20)
      : orgId
        ? supabase.from('activities').select('*').eq('org_id', orgId).order('occurred_at', { ascending: false }).limit(20)
        : null
    if (actQuery) { const { data } = await actQuery; activities = data || [] }

    // Get properties
    if (orgId) {
      const { data } = await supabase.from('properties').select('*').eq('org_id', orgId)
      properties = data || []
    }

    // Get key notes
    if (contactId) {
      const { data } = await supabase.from('key_notes').select('*').eq('contact_id', contactId)
      keyNotes = data || []
    }

    const vertical = (org?.vertical || deal?.vertical || 'multifamily') as Vertical
    const playbook = PLAYBOOKS[vertical]
    const crmContext = buildContactContext(contact, org, activities, deal)

    let extraContext = ''
    if (properties.length > 0) {
      extraContext += `\nPROPERTIES IN PORTFOLIO:\n`
      properties.forEach(p => {
        extraContext += `- ${p.name}${p.city ? `, ${p.city}` : ''}${p.unit_count ? ` (${p.unit_count} units)` : ''}${p.key_count ? ` (${p.key_count} keys)` : ''}${p.pip_status ? ` — PIP: ${p.pip_status}` : ''}\n`
      })
    }
    if (keyNotes.length > 0) {
      extraContext += `\nPERSONAL NOTES ABOUT THIS CONTACT:\n`
      keyNotes.forEach(n => {
        extraContext += `- ${n.category}: ${n.title}${n.note ? ` (${n.note})` : ''}\n`
      })
    }

    const systemPrompt = `You are a sales meeting preparation assistant for ONE70 Group. Generate a concise, actionable meeting prep brief for an upcoming discovery call.

COMPANY: ONE70 Group — ${playbook.tagline}
Three Uniques: Clear Cost, Clear Schedule, Ability to Scale

DISCOVERY FRAMEWORK (20-min call):
Phase 1 (0-2 min): Set context — diagnostic conversation, not a pitch
Phase 2 (2-8 min): Portfolio discovery — scale, scope, rhythm
Phase 3 (8-14 min): Pain point excavation — listen for specific friction
Phase 4 (14-16 min): Qualification check — fit, authority, budget
Phase 5 (16-19 min): Present relevant ONE70 differentiators
Phase 6 (19-20 min): Define clear next step

RECOMMENDED DISCOVERY QUESTIONS for ${playbook.vertical}:
${playbook.discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

PAIN POINTS TO LISTEN FOR:
${playbook.painPoints.map(p => `- ${p}`).join('\n')}`

    const userPrompt = `Generate a meeting prep brief for this upcoming call.

CRM DATA:
${crmContext}
${extraContext}

FORMAT THE BRIEF AS:
1. QUICK SUMMARY — who they are, why we're talking (2-3 sentences)
2. WHAT WE KNOW — key facts from CRM data (bullet points)
3. PERSONAL TOUCHES — anything personal to reference naturally (from key notes)
4. RECOMMENDED QUESTIONS — pick the 4-5 best discovery questions based on what we know and don't know
5. HYPOTHESIS — what their likely pain point is based on their profile
6. ONE70 ANGLE — which of our three uniques to lead with and why
7. GOAL FOR THIS CALL — what specific next step to push for`

    const brief = await callClaude(systemPrompt, userPrompt, 2000)

    return NextResponse.json({ success: true, brief })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
