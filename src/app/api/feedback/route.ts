import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.FEEDBACK_EMAIL || process.env.FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'info@one70group.com'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, subject, description, page_url, feedback_id } = await request.json()
  if (!type || !subject) return NextResponse.json({ error: 'Type and subject required' }, { status: 400 })

  // Get user name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // NOTE: The feedback record is already inserted by the client.
  // This endpoint ONLY sends the email notification.
  try {
    const typeLabel = type === 'bug' ? '🐛 Bug Report' : type === 'feature' ? '💡 Feature Request' : '📝 Improvement'
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'ONE70 CRM <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `[ONE70 CRM] ${typeLabel}: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1A1A1A; margin-bottom: 4px;">${typeLabel}</h2>
          <p style="color: #666; margin-top: 0;">From: ${profile?.full_name || 'Unknown'} (${user.email})</p>
          <hr style="border: 1px solid #E5E5E5;">
          <p><strong>Subject:</strong> ${subject}</p>
          ${description ? `<p><strong>Details:</strong></p><p style="color: #333;">${description.replace(/\n/g, '<br>')}</p>` : ''}
          ${page_url ? `<p style="color: #999; font-size: 12px;">Page: ${page_url}</p>` : ''}
          <hr style="border: 1px solid #E5E5E5;">
          <p style="color: #999; font-size: 12px;">View all feedback in CRM → Feedback</p>
        </div>
      `,
    })
  } catch (emailErr) {
    console.error('Feedback email failed:', emailErr)
  }

  return NextResponse.json({ success: true })
}

// GET - for admin to list all feedback
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'admin') {
    // Admin sees all
    const { data } = await supabase
      .from('feedback')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })
    return NextResponse.json({ feedback: data || [] })
  } else {
    // Users see only their own
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return NextResponse.json({ feedback: data || [] })
  }
}
