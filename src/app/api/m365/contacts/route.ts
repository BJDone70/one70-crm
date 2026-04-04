import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchPeople, getContacts, searchContacts, isM365Connected } from '@/lib/microsoft-graph'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isM365Connected(user.id)
  if (!connected) return NextResponse.json({ error: 'M365 not connected' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'search'
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '10')

  try {
    if (action === 'people') {
      // Search people for email autocomplete
      const results = await searchPeople(user.id, query, limit)
      return NextResponse.json({ results })
    } else if (action === 'contacts') {
      // Get all M365 contacts for import
      const contacts = query
        ? await searchContacts(user.id, query, limit)
        : await getContacts(user.id, limit)
      return NextResponse.json({ contacts })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// Import M365 contacts into CRM
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contacts } = await request.json()
  if (!contacts?.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const c of contacts) {
    if (!c.first_name && !c.last_name) { skipped++; continue }

    // Check if contact already exists by email
    if (c.email) {
      const { data: existing } = await supabase.from('contacts')
        .select('id').ilike('email', c.email).is('deleted_at', null).limit(1)
      if (existing?.length) { skipped++; continue }
    }

    // Try to match company to org
    let orgId = null
    if (c.company) {
      const { data: org } = await supabase.from('organizations')
        .select('id').ilike('name', `%${c.company}%`).is('deleted_at', null).limit(1)
      if (org?.[0]) orgId = org[0].id
    }

    const firstName = (c.first_name || '').trim().toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase())
    const lastName = (c.last_name || '').trim().toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase())

    const { error } = await supabase.from('contacts').insert({
      first_name: firstName,
      last_name: lastName,
      email: c.email || null,
      phone: c.phone || null,
      mobile_phone: c.mobile_phone || null,
      title: c.title || null,
      org_id: orgId,
      contact_type: 'prospect',
    })

    if (error) { errors.push(`${firstName} ${lastName}: ${error.message}`); continue }
    imported++
  }

  return NextResponse.json({ imported, skipped, errors })
}
