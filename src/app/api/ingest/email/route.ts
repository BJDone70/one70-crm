export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get('x-webhook-secret') || ''
  if (!process.env.EMAIL_INGEST_SECRET || secret !== process.env.EMAIL_INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  try {
    const body = await request.json()

    // Resend inbound email format
    const from = body.from || body.sender || ''
    const to = body.to || ''
    const subject = body.subject || ''
    const textBody = body.text || body.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') || ''
    const headers = body.headers || {}

    // Find the forwarding user by matching the "from" or "reply-to" against profiles
    const forwarderEmail = from.match(/<(.+?)>/)?.[1] || from.split(' ').pop() || ''
    const { data: forwarder } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.in.(${
        (await supabaseAdmin.auth.admin.listUsers()).data?.users
          ?.filter(u => u.email === forwarderEmail)
          ?.map(u => `"${u.id}"`)
          ?.join(',') || '""'
      })`)
      .limit(1)
      .single()

    // Default to first admin if forwarder not found
    let userId = forwarder?.id
    if (!userId) {
      const { data: admin } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
        .limit(1)
        .single()
      userId = admin?.id
    }

    if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 400 })

    const fullText = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\n${textBody}`

    // AI extraction
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
        messages: [{ role: 'user', content: `Extract CRM data from this forwarded email. Return ONLY a JSON object.

EMAIL:
${fullText.substring(0, 3000)}

Return:
{
  "contact": {
    "first_name": "string or null",
    "last_name": "string or null",
    "title": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "company": "string or null"
  },
  "activity": {
    "type": "email",
    "subject": "brief subject",
    "body": "relevant content summary (2-3 sentences max)"
  },
  "deal_name": "string or null",
  "deal_value": "number or null",
  "vertical": "multifamily | hotel | senior_living | null",
  "task": "follow-up task title if implied, or null"
}

Rules:
- The sender of the original email (not the forwarder) is the contact
- Extract company from email signature or domain
- Keep activity body concise` }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'AI failed' }, { status: 500 })

    const aiData = await res.json()
    const rawText = aiData.content?.[0]?.text || '{}'
    const cleaned = rawText.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const created: string[] = []

    // Find or create contact
    let contactId = null
    let orgId = null
    const c = parsed.contact

    if (c?.email) {
      const { data: existing } = await supabaseAdmin.from('contacts')
        .select('id, org_id').ilike('email', c.email)
        .is('deleted_at', null).limit(1)
      if (existing?.[0]) {
        contactId = existing[0].id
        orgId = existing[0].org_id
        created.push(`Matched contact: ${c.first_name} ${c.last_name}`)
      }
    }

    if (!contactId && c?.first_name) {
      // Create org first if company provided
      if (c.company) {
        const { data: existingOrg } = await supabaseAdmin.from('organizations')
          .select('id').ilike('name', `%${c.company}%`)
          .is('deleted_at', null).limit(1)
        if (existingOrg?.[0]) {
          orgId = existingOrg[0].id
        } else {
          const { data: newOrg } = await supabaseAdmin.from('organizations')
            .insert({ name: c.company, vertical: parsed.vertical || 'multifamily' })
            .select('id').single()
          if (newOrg) { orgId = newOrg.id; created.push(`Created org: ${c.company}`) }
        }
      }

      const { data: newContact } = await supabaseAdmin.from('contacts')
        .insert({
          first_name: c.first_name, last_name: c.last_name || '',
          title: c.title || null, email: c.email || null,
          phone: c.phone || null, org_id: orgId,
        }).select('id').single()
      if (newContact) { contactId = newContact.id; created.push(`Created contact: ${c.first_name} ${c.last_name}`) }
    }

    // Log activity
    if (parsed.activity?.subject) {
      await supabaseAdmin.from('activities').insert({
        type: 'email', subject: parsed.activity.subject,
        body: parsed.activity.body || textBody.substring(0, 500),
        contact_id: contactId, org_id: orgId, user_id: userId,
        direction: 'inbound',
      })
      created.push(`Logged email: ${parsed.activity.subject}`)
    }

    // Log to email_interactions for monitoring
    const senderEmail = c?.email || forwarderEmail
    try {
      await supabaseAdmin.from('email_interactions').insert({
        user_id: userId,
        contact_id: contactId,
        org_id: orgId,
        direction: 'inbound',
        from_email: senderEmail,
        to_email: forwarderEmail,
        subject: parsed.activity?.subject || subject,
        snippet: (parsed.activity?.body || textBody || '').substring(0, 300),
        needs_reply: true,
        source: 'forwarded',
      })
    } catch (err: any) {
      console.error('[email-ingest] Failed to log email interaction:', err)
    }

    // Create task if implied
    if (parsed.task) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      await supabaseAdmin.from('tasks').insert({
        title: parsed.task, type: 'follow_up', priority: 'medium',
        due_date: dueDate.toISOString().split('T')[0],
        contact_id: contactId, org_id: orgId,
        assigned_to: userId, created_by: userId,
      })
      created.push(`Created task: ${parsed.task}`)
    }

    // Email confirmation to the forwarder
    if (created.length > 0 && forwarderEmail) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'ONE70 CRM <onboarding@resend.dev>',
          to: forwarderEmail,
          subject: `[CRM] Processed: ${subject}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px">
              <h3 style="color:#1A1A1A;margin-bottom:8px">Email processed into CRM</h3>
              <ul style="color:#333;font-size:14px">${created.map(c => `<li>${c}</li>`).join('')}</ul>
              <p style="color:#999;font-size:12px;margin-top:16px">
                <a href="https://crm.one70group.com${contactId ? `/contacts/${contactId}` : ''}">Open in CRM →</a>
              </p>
            </div>
          `,
        })
      } catch (err: any) {
        console.error('[email-ingest] Failed to send confirmation email:', err)
      }
    }

    return NextResponse.json({ success: true, created })
  } catch (err: any) {
    console.error('Email ingest error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
