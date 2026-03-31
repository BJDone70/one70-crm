import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'
import { callClaude } from '@/lib/ai-utils'

export async function POST(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 10, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notes, contactId, orgId, dealId } = await request.json()
    if (!notes) return NextResponse.json({ error: 'Notes are required' }, { status: 400 })

    // Get context
    let contactName = '', orgName = '', dealStage = ''
    if (contactId) {
      const { data } = await supabase.from('contacts').select('first_name, last_name').eq('id', contactId).single()
      if (data) contactName = `${data.first_name} ${data.last_name}`
    }
    if (orgId) {
      const { data } = await supabase.from('organizations').select('name').eq('id', orgId).single()
      if (data) orgName = data.name
    }
    if (dealId) {
      const { data } = await supabase.from('deals').select('stage, name').eq('id', dealId).single()
      if (data) dealStage = data.stage
    }

    const systemPrompt = `You are a CRM assistant for ONE70 Group, a commercial construction company. Your job is to parse raw meeting/call notes and extract structured data for the CRM.

You must return ONLY valid JSON with no other text. Use this exact structure:

{
  "summary": "2-3 sentence summary of the conversation",
  "activity": {
    "type": "call|meeting|site_visit",
    "subject": "Brief subject line for the activity",
    "body": "Clean, organized version of the notes"
  },
  "tasks": [
    {
      "title": "What needs to happen",
      "type": "follow_up|next_step|todo",
      "priority": "high|normal|low",
      "due_days": 3
    }
  ],
  "key_notes": [
    {
      "category": "birthday|anniversary|preference|family|hobby|important_date|other",
      "title": "Brief note title",
      "note": "Details"
    }
  ],
  "suggested_deal_stage": null,
  "pain_points_identified": ["list of pain points mentioned"],
  "next_step": "The agreed-upon next step from the conversation"
}`

    const userPrompt = `Parse these meeting/call notes and extract structured CRM data.

Contact: ${contactName || 'Unknown'}
Organization: ${orgName || 'Unknown'}
${dealStage ? `Current deal stage: ${dealStage}` : 'No active deal'}

RAW NOTES:
${notes}

Extract:
1. A clean activity summary
2. Follow-up tasks with realistic due dates (in days from today)
3. Any personal details worth saving as key notes (birthdays, preferences, family, hobbies)
4. If there's a deal, suggest whether the stage should change based on what happened
5. Any pain points the prospect mentioned
6. The agreed-upon next step

Return ONLY the JSON.`

    const result = await callClaude(systemPrompt, userPrompt, 2000)

    try {
      const cleaned = result.replace(/```json\n?|```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({ success: true, parsed })
    } catch {
      return NextResponse.json({ error: 'Failed to parse the notes. Try adding more detail.' }, { status: 422 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
