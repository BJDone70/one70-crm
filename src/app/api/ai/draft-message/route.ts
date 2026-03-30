import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'
import { callClaude, PLAYBOOKS, buildContactContext, Vertical } from '@/lib/ai-utils'

export async function POST(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 15, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { contactId, orgId, dealId, channel, sequenceStep } = await request.json()

    // Load CRM data
    let contact = null, org = null, deal = null, activities: any[] = []

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
    if (contactId) {
      const { data } = await supabase.from('activities').select('*').eq('contact_id', contactId).order('occurred_at', { ascending: false }).limit(10)
      activities = data || []
    }

    const vertical = (org?.vertical || deal?.vertical || 'multifamily') as Vertical
    const playbook = PLAYBOOKS[vertical] || PLAYBOOKS['multifamily']
    const crmContext = buildContactContext(contact, org, activities, deal)

    // Require at minimum a contactId to have been provided
    if (!contactId && !orgId && !dealId) {
      return NextResponse.json({ error: 'No contact, organization, or deal specified.' }, { status: 400 })
    }

    // Load user's writing style
    let styleBlock = ''
    try {
      const { data: styleData } = await supabase.from('user_style_profiles').select('style_profile').eq('user_id', user.id).single()
      if (styleData?.style_profile) {
        styleBlock = `\n\nUSER WRITING STYLE — Match this person's voice when drafting:\n${styleData.style_profile}\n`
      }
    } catch {}

    const systemPrompt = `You are a sales message drafting assistant for ONE70 Group, a full-scope commercial construction company operating across the Eastern US. Your job is to write personalized outreach messages that feel human, direct, and confident — not salesy or generic.
${styleBlock}

COMPANY POSITIONING:
- Tagline: ${playbook.tagline}
- Three Uniques: Clear Cost (${playbook.threeUniques.clearCost}), Clear Schedule (${playbook.threeUniques.clearSchedule}), Ability to Scale (${playbook.threeUniques.abilityToScale})
- Ideal Client: ${playbook.idealClient}
- Scope of Work: ${playbook.scopeOfWork}

COMMON PAIN POINTS for ${playbook.vertical} clients:
${playbook.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

RULES:
- The goal of every message is to earn a 20-minute conversation, NOT to sell
- Be direct and concise — these are busy operators
- Reference specific details from the CRM context (their portfolio, properties, past interactions)
- Match the tone to the channel (email = professional, LinkedIn = shorter/conversational, text = very brief)
- Never fabricate facts about their company — only use what's in the CRM data
- Sign off as the user from ONE70 Group
- If this is a follow-up, reference previous interactions from the activity history`

    const userPrompt = `Write a ${channel} message for this ${sequenceStep || 'cold outreach'}.

CRM CONTEXT:
${crmContext}

Channel: ${channel}
Sequence step: ${sequenceStep || 'cold_open'}
${(playbook as any).emailSequence?.[sequenceStep] ? `Playbook guidance: ${JSON.stringify((playbook as any).emailSequence[sequenceStep])}` : ''}

${channel === 'email' ? 'Include a subject line at the top.' : ''}
${channel === 'text' ? 'Keep it under 300 characters.' : ''}
${channel === 'linkedin' ? 'Keep it under 500 characters.' : ''}`

    const message = await callClaude(systemPrompt, userPrompt, 1500)

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
