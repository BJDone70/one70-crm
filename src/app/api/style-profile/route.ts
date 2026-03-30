import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getSentEmails, isM365Connected } from '@/lib/microsoft-graph'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: return user's current style profile
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('user_style_profiles')
    .select('*').eq('user_id', user.id).single()

  return NextResponse.json({ profile: data })
}

// POST: analyze sent emails and generate style profile
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isM365Connected(user.id)
  if (!connected) return NextResponse.json({ error: 'M365 not connected' }, { status: 400 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  try {
    // Pull last 60 days of sent emails
    const sinceDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const sentEmails = await getSentEmails(user.id, sinceDate, 50)

    if (!sentEmails?.length) {
      return NextResponse.json({ error: 'No sent emails found. Send some emails and try again.' }, { status: 400 })
    }

    // Extract just the user-written portions (previews)
    const samples = sentEmails
      .filter((e: any) => e.bodyPreview && e.bodyPreview.length > 10)
      .map((e: any) => ({
        subject: e.subject || '',
        preview: (e.bodyPreview || '').substring(0, 300),
        to: (e.toRecipients || []).map((r: any) => r.emailAddress?.name || '').join(', '),
      }))
      .slice(0, 40) // Cap at 40 samples

    if (samples.length < 5) {
      return NextResponse.json({ error: 'Not enough sent emails to analyze (need at least 5).' }, { status: 400 })
    }

    // Send to Claude for analysis
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze these sent email samples from a business professional and create a detailed writing style profile. This profile will be used to ghost-write emails in their voice.

SENT EMAIL SAMPLES:
${samples.map((s: any, i: number) => `[${i + 1}] To: ${s.to} | Subject: ${s.subject}\n${s.preview}`).join('\n\n')}

Generate a writing style profile as a structured description covering these dimensions:
1. TONE: formal/informal/conversational, warmth level, authority level
2. LENGTH: typical response length, how verbose vs concise
3. GREETINGS: how they open emails (name only, "Hi X", "Hey", nothing, etc.)
4. CLOSINGS: how they end emails (sign-off phrases, thanks patterns)
5. SENTENCE STRUCTURE: short/long, simple/complex, fragments vs full sentences
6. VOCABULARY: industry jargon they use, common phrases, word choices
7. DIRECTNESS: how quickly they get to the point, use of pleasantries
8. QUESTIONS: how they ask questions, how assertive
9. FOLLOW-UPS: how they handle follow-up requests
10. PERSONALITY MARKERS: any distinctive patterns, humor, expressions

Write this as a concise instruction that could be given to an AI to mimic their style. Start with "Write in this person's voice:" and keep it under 500 words. Be specific with examples from the samples.`,
        }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Style analysis failed' }, { status: 500 })
    }

    const data = await res.json()
    const styleProfile = data.content?.[0]?.text || ''

    if (!styleProfile) {
      return NextResponse.json({ error: 'No profile generated' }, { status: 500 })
    }

    // Save to database
    await supabaseAdmin.from('user_style_profiles').upsert({
      user_id: user.id,
      style_instruction: styleProfile,
      sample_count: samples.length,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true, profile: styleProfile, samples: samples.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
