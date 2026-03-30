import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { text, source } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

  try {
    // Step 1: AI extracts structured data
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Extract CRM-relevant information from this message. Return ONLY a JSON object with no other text or markdown.

MESSAGE SOURCE: ${source || 'unknown'}

MESSAGE:
${text.substring(0, 3000)}

Return this exact JSON structure (use null for unknown fields):
{
  "contacts": [
    {
      "first_name": "string or null",
      "last_name": "string or null",
      "title": "job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "company": "company name or null",
      "linkedin_url": "url or null"
    }
  ],
  "summary": "1-2 sentence summary of what this message is about",
  "suggested_actions": [
    {
      "type": "create_contact | create_deal | log_activity | create_task",
      "label": "human-readable description of what to do",
      "data": {}
    }
  ],
  "deal_info": {
    "name": "deal name if mentioned or null",
    "value": "numeric value if mentioned or null",
    "vertical": "multifamily | hotel | senior_living | null",
    "services": "services discussed or null"
  },
  "activity": {
    "type": "email | call | meeting | note",
    "subject": "brief subject line",
    "body": "relevant content to log"
  },
  "task": {
    "title": "follow-up task if implied or null",
    "due_hint": "any mentioned date or timeframe or null",
    "priority": "high | medium | low"
  }
}

Rules:
- Extract ALL people mentioned with as much detail as available
- If it's a forwarded email, the sender is usually the primary contact
- Identify the vertical from context (multifamily apartments, hotel/hospitality, senior living)
- Suggest concrete next actions
- If a meeting or call is mentioned, suggest logging it as an activity
- If follow-up is implied, suggest a task` }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })

    const aiData = await res.json()
    const rawText = aiData.content?.[0]?.text || '{}'
    const cleaned = rawText.replace(/```json\n?|```\n?/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr: any) {
      return NextResponse.json({ error: 'Invalid JSON from AI processing', details: parseErr.message }, { status: 422 })
    }

    // Step 2: Match existing contacts/orgs
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Invalid parsed data structure', details: 'Expected an object' }, { status: 422 })
    }

    const enriched = { ...parsed, matches: { contacts: [], organizations: [] } }

    for (const contact of (parsed.contacts || [])) {
      if (contact.email) {
        const { data } = await supabase.from('contacts')
          .select('id, first_name, last_name, email, org_id, organizations:org_id(name)')
          .ilike('email', contact.email)
          .is('deleted_at', null).limit(1)
        if (data?.[0]) {
          enriched.matches.contacts.push({ ...data[0], matched_by: 'email' })
          continue
        }
      }
      if (contact.first_name && contact.last_name) {
        const { data } = await supabase.from('contacts')
          .select('id, first_name, last_name, email, org_id, organizations:org_id(name)')
          .ilike('first_name', `${contact.first_name}%`)
          .ilike('last_name', `${contact.last_name}%`)
          .is('deleted_at', null).limit(1)
        if (data?.[0]) {
          enriched.matches.contacts.push({ ...data[0], matched_by: 'name' })
          continue
        }
      }
      if (contact.company) {
        const { data } = await supabase.from('organizations')
          .select('id, name')
          .ilike('name', `%${contact.company}%`)
          .is('deleted_at', null).limit(1)
        if (data?.[0] && !enriched.matches.organizations.find((o: any) => o.id === data[0].id)) {
          enriched.matches.organizations.push(data[0])
        }
      }
    }

    return NextResponse.json({ success: true, parsed: enriched })
  } catch (err: any) {
    console.error('Ingest error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}

// Execute actions from the ingest results
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actions } = await request.json()
  if (!actions?.length) return NextResponse.json({ error: 'No actions' }, { status: 400 })

  const results: any[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_contact': {
          const d = action.data
          let orgId = null
          let createdOrgId = null // Track if we created a new org for cleanup

          try {
            if (d.company) {
              const { data: orgs } = await supabase.from('organizations')
                .select('id').ilike('name', `%${d.company}%`)
                .is('deleted_at', null).limit(1)
              if (orgs?.[0]) {
                orgId = orgs[0].id
              } else {
                const { data: newOrg } = await supabase.from('organizations')
                  .insert({ name: d.company, vertical: d.vertical || 'multifamily' })
                  .select('id').single()
                if (newOrg) {
                  orgId = newOrg.id
                  createdOrgId = newOrg.id // Save for cleanup if contact fails
                }
              }
            }

            const { data, error } = await supabase.from('contacts').insert({
              first_name: d.first_name, last_name: d.last_name,
              title: d.title || null, email: d.email || null,
              phone: d.phone || null, org_id: orgId,
              linkedin_url: d.linkedin_url || null,
            }).select().single()

            if (error && createdOrgId) {
              // Contact creation failed, clean up the org we just created
              try {
                await supabase.from('organizations').delete().eq('id', createdOrgId)
              } catch (cleanupErr) {
                console.error('[ingest] Failed to cleanup org after contact creation failure:', cleanupErr)
              }
            }

            results.push({ type: 'create_contact', success: !error, id: data?.id, error: error?.message,
              label: `${d.first_name} ${d.last_name}`, link: data ? `/contacts/${data.id}` : null })
          } catch (contactErr: any) {
            // Exception during contact creation, clean up org if we created one
            if (createdOrgId) {
              try {
                await supabase.from('organizations').delete().eq('id', createdOrgId)
              } catch (cleanupErr) {
                console.error('[ingest] Failed to cleanup org after contact exception:', cleanupErr)
              }
            }
            throw contactErr
          }
          break
        }

        case 'create_deal': {
          const d = action.data
          let orgId = null, contactId = null
          if (d.org_id) orgId = d.org_id
          if (d.contact_id) contactId = d.contact_id
          const { data, error } = await supabase.from('deals').insert({
            name: d.name, vertical: d.vertical || 'multifamily',
            stage: 'new_lead', value: d.value || null,
            org_id: orgId, contact_id: contactId,
            services_offered: d.services || null,
            assigned_to: user.id, created_by: user.id,
          }).select().single()
          results.push({ type: 'create_deal', success: !error, id: data?.id, error: error?.message,
            label: d.name, link: data ? `/deals/${data.id}` : null })
          break
        }

        case 'log_activity': {
          const d = action.data
          const { data, error } = await supabase.from('activities').insert({
            type: d.type || 'note', subject: d.subject, body: d.body,
            contact_id: d.contact_id || null, org_id: d.org_id || null,
            user_id: user.id,
          }).select().single()
          results.push({ type: 'log_activity', success: !error, id: data?.id, error: error?.message,
            label: d.subject, link: d.contact_id ? `/contacts/${d.contact_id}` : '/activities' })
          break
        }

        case 'create_task': {
          const d = action.data
          // Parse due date hints
          let dueDate = null
          if (d.due_date) {
            dueDate = d.due_date
          } else if (d.due_hint) {
            const today = new Date()
            const hint = d.due_hint.toLowerCase()
            if (hint.includes('tomorrow')) {
              today.setDate(today.getDate() + 1)
              dueDate = today.toISOString().split('T')[0]
            } else if (hint.includes('next week')) {
              today.setDate(today.getDate() + 7)
              dueDate = today.toISOString().split('T')[0]
            } else if (hint.includes('end of week') || hint.includes('friday')) {
              const daysTilFri = (5 - today.getDay() + 7) % 7 || 7
              today.setDate(today.getDate() + daysTilFri)
              dueDate = today.toISOString().split('T')[0]
            }
          }

          const { data, error } = await supabase.from('tasks').insert({
            title: d.title, description: d.description || null,
            type: 'follow_up', priority: d.priority || 'medium',
            due_date: dueDate, assigned_to: user.id, created_by: user.id,
            contact_id: d.contact_id || null, org_id: d.org_id || null,
          }).select().single()
          results.push({ type: 'create_task', success: !error, id: data?.id, error: error?.message,
            label: d.title, link: data ? `/tasks/${data.id}` : '/tasks' })
          break
        }
      }
    } catch (err: any) {
      results.push({ type: action.type, success: false, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
