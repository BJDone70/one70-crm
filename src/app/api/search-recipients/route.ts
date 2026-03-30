import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  if (q.length < 2) return NextResponse.json({ results: [] })

  const results: { name: string; email: string; source: string }[] = []

  // 1. Search CRM contacts first (always available)
  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('first_name, last_name, email, organizations(name)')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .not('email', 'is', null)
      .is('deleted_at', null)
      .limit(8)

    if (contacts) {
      for (const c of contacts) {
        if (c.email) {
          results.push({
            name: `${c.first_name} ${c.last_name}`.trim(),
            email: c.email,
            source: (c.organizations as any)?.name || 'CRM',
          })
        }
      }
    }
  } catch {}

  // 2. Search M365 People (if connected)
  try {
    const { searchPeople, isM365Connected } = await import('@/lib/microsoft-graph')
    const connected = await isM365Connected(user.id)
    if (connected) {
      const people = await searchPeople(user.id, q, 5)
      for (const p of people) {
        // Don't duplicate emails already in CRM results
        if (p.email && !results.some(r => r.email.toLowerCase() === p.email.toLowerCase())) {
          results.push({ name: p.name, email: p.email, source: p.company || 'M365' })
        }
      }
    }
  } catch {}

  return NextResponse.json({ results: results.slice(0, 10) })
}
