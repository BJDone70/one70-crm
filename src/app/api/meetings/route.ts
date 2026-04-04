import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { subject, meeting_date, location, attendees, notes, contact_id, org_id, contact_name } = body

  if (!subject || !meeting_date) return NextResponse.json({ error: 'subject and meeting_date required' }, { status: 400 })

  // Auto-match contact by name if not provided
  let matchedContactId = contact_id || null
  let matchedOrgId = org_id || null

  if (!matchedContactId && contact_name) {
    const words = contact_name.trim().split(/\s+/)
    if (words.length >= 2) {
      const { data } = await supabase.from('contacts')
        .select('id, org_id')
        .ilike('first_name', `%${words[0]}%`)
        .ilike('last_name', `%${words[words.length - 1]}%`)
        .is('deleted_at', null).limit(1)
      if (data?.[0]) { matchedContactId = data[0].id; matchedOrgId = matchedOrgId || data[0].org_id }
    } else if (words[0]?.length > 1) {
      const { data } = await supabase.from('contacts')
        .select('id, org_id')
        .or(`first_name.ilike.%${words[0]}%,last_name.ilike.%${words[0]}%`)
        .is('deleted_at', null).limit(1)
      if (data?.[0]) { matchedContactId = data[0].id; matchedOrgId = matchedOrgId || data[0].org_id }
    }
  }

  const { data, error } = await supabase.from('meeting_tracking').insert({
    user_id: user.id, contact_id: matchedContactId, org_id: matchedOrgId,
    subject, meeting_date, location: location || null,
    attendees: attendees || null, notes: notes || null,
    source: 'manual',
  }).select().single()

  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  return NextResponse.json({ meeting: data })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'upcoming'

  let query = supabase
    .from('meeting_tracking')
    .select('*, contacts(first_name, last_name), organizations(name)')
    .eq('user_id', user.id)

  const now = new Date().toISOString()
  if (filter === 'upcoming') {
    query = query.gte('meeting_date', now).order('meeting_date', { ascending: true })
  } else if (filter === 'past') {
    query = query.lt('meeting_date', now).order('meeting_date', { ascending: false })
  } else {
    query = query.order('meeting_date', { ascending: false })
  }

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  return NextResponse.json({ meetings: data || [] })
}
