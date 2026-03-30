import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, isM365Connected } from '@/lib/microsoft-graph'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isM365Connected(user.id)
  if (!connected) return NextResponse.json({ error: 'Microsoft 365 not connected. Go to Settings → Integrations to connect.' }, { status: 400 })

  const { to, cc, subject, body, contact_id, org_id, deal_id } = await request.json()
  if (!to?.length || !subject) return NextResponse.json({ error: 'Recipient and subject required' }, { status: 400 })

  try {
    await sendEmail(user.id, Array.isArray(to) ? to : [to], subject, body || '', cc ? (Array.isArray(cc) ? cc : [cc]) : undefined)

    // Log as email interaction
    if (contact_id) {
      await supabaseAdmin.from('email_interactions').insert({
        user_id: user.id,
        contact_id,
        org_id: org_id || null,
        direction: 'outbound',
        from_email: '',
        to_email: Array.isArray(to) ? to[0] : to,
        subject,
        snippet: (body || '').replace(/<[^>]*>/g, '').substring(0, 300),
        received_at: new Date().toISOString(),
        needs_reply: false,
        source: 'sent_from_crm',
      })
    }

    // Log as activity
    await supabaseAdmin.from('activities').insert({
      type: 'email',
      subject: `Sent: ${subject}`,
      body: `To: ${Array.isArray(to) ? to.join(', ') : to}`,
      contact_id: contact_id || null,
      org_id: org_id || null,
      deal_id: deal_id || null,
      user_id: user.id,
      direction: 'outbound',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 })
  }
}
