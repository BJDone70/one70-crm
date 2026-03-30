import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Get Apollo API key
  const { data: integration } = await supabase.from('integrations')
    .select('api_key').eq('user_id', user.id).eq('provider', 'apollo').eq('is_active', true).single()

  if (!integration?.api_key) return NextResponse.json({ error: 'Apollo.io not connected. Add your API key in Settings > Integrations.' }, { status: 400 })

  const { contact_ids } = await req.json()
  if (!contact_ids?.length) return NextResponse.json({ error: 'No contacts to enrich' }, { status: 400 })

  const { data: contacts } = await supabase.from('contacts')
    .select('id, first_name, last_name, email, title, phone, linkedin_url, org_id, organizations(name)')
    .in('id', contact_ids)

  let enriched = 0
  for (const contact of (contacts || [])) {
    try {
      const searchParams: any = {}
      if (contact.email) searchParams.email = contact.email
      else {
        searchParams.first_name = contact.first_name
        searchParams.last_name = contact.last_name
        if ((contact as any).organizations?.name) searchParams.organization_name = (contact as any).organizations.name
      }

      const res = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': integration.api_key },
        body: JSON.stringify(searchParams),
      })

      if (!res.ok) continue
      const data = await res.json()
      const person = data.person

      if (person) {
        const updates: any = {}
        if (person.email && !contact.email) updates.email = person.email
        if (person.title && !contact.title) updates.title = person.title
        if (person.phone_numbers?.[0]?.sanitized_number && !contact.phone) updates.phone = person.phone_numbers[0].sanitized_number
        if (person.linkedin_url && !contact.linkedin_url) updates.linkedin_url = person.linkedin_url

        if (Object.keys(updates).length > 0) {
          await supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', contact.id)
          enriched++
        }
      }
    } catch (err) {
      console.error(`Failed to enrich contact ${contact.id}:`, err)
    }
  }

  return NextResponse.json({ enriched, total: contacts?.length || 0 })
}

// GET endpoint for quick enrich from settings page
export async function GET() {
  return NextResponse.json({ message: 'Use POST with contact_ids array to enrich contacts. Or use the Enrich button on contact pages.' })
}
