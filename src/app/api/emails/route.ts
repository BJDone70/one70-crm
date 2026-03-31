import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = rateLimitByIp(ip, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { from_email, to_email, subject, snippet, direction, contact_id, org_id } = body

  if (!from_email || !subject) {
    return NextResponse.json({ error: 'from_email and subject required' }, { status: 400 })
  }

  // Auto-match contact by email if not provided
  let matchedContactId = contact_id || null
  let matchedOrgId = org_id || null
  const emailToMatch = direction === 'inbound' ? from_email : to_email

  if (!matchedContactId && emailToMatch) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, org_id')
      .ilike('email', emailToMatch.trim())
      .is('deleted_at', null)
      .limit(1)
    if (contacts?.[0]) {
      matchedContactId = contacts[0].id
      if (!matchedOrgId) matchedOrgId = contacts[0].org_id
    }
  }

  const { data, error } = await supabase.from('email_interactions').insert({
    user_id: user.id,
    contact_id: matchedContactId,
    org_id: matchedOrgId,
    direction: direction || 'inbound',
    from_email,
    to_email: to_email || null,
    subject,
    snippet: snippet || null,
    needs_reply: direction === 'inbound',
    source: 'manual',
  }).select().single()

  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

  return NextResponse.json({ interaction: data })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'needs_reply'

  let query = supabase
    .from('email_interactions')
    .select('*, contacts(first_name, last_name, email), organizations(name)')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })

  if (filter === 'needs_reply') {
    query = query.eq('needs_reply', true).is('replied_at', null)
  } else if (filter === 'follow_up') {
    query = query.not('follow_up_date', 'is', null).is('replied_at', null)
  }

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

  return NextResponse.json({ interactions: data || [] })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('email_interactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  return NextResponse.json({ success: true })
}
