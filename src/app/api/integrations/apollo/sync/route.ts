import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: integration } = await supabase.from('integrations')
    .select('api_key').eq('user_id', user.id).eq('provider', 'apollo').eq('is_active', true).single()

  if (!integration?.api_key) return NextResponse.json({ error: 'Apollo.io not connected' }, { status: 400 })

  const { query, vertical, limit = 25 } = await req.json()

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': integration.api_key },
      body: JSON.stringify({
        q_keywords: query,
        per_page: Math.min(limit, 50),
        person_titles: ['VP Construction', 'VP Capital', 'Director of Construction', 'Asset Manager', 'VP Operations', 'SVP Construction', 'Director Capital Improvements', 'VP Renovations'],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Apollo API error' }, { status: res.status })
    const data = await res.json()
    const people = data.people || []

    let imported = 0; let skipped = 0

    for (const person of people) {
      // Check if contact already exists by email
      if (person.email) {
        const { data: existing } = await supabase.from('contacts').select('id').eq('email', person.email).single()
        if (existing) { skipped++; continue }
      }

      // Try to match org
      let orgId = null
      if (person.organization?.name) {
        const { data: org } = await supabase.from('organizations')
          .select('id').ilike('name', `%${person.organization.name}%`).single()
        orgId = org?.id
      }

      await supabase.from('contacts').insert({
        first_name: person.first_name || 'Unknown',
        last_name: person.last_name || 'Unknown',
        email: person.email || null,
        title: person.title || null,
        phone: person.phone_numbers?.[0]?.sanitized_number || null,
        linkedin_url: person.linkedin_url || null,
        org_id: orgId,
        notes: person.organization?.name && !orgId ? `Company: ${person.organization.name}` : null,
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, total: people.length })
  } catch (err: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST with {query, vertical, limit} to search and import Apollo prospects.' })
}
