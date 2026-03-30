import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 30, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    // Multi-word: split into words, search with first word, score with all words
    const words = q.split(/\s+/).filter(w => w.length > 1)
    const pattern = `%${words[0]}%`
    const fullPattern = `%${q}%`

    const [orgs, contacts, deals, properties, projects, tasks, activities, emails] = await Promise.all([
      supabase.from('organizations')
        .select('id, name, vertical, hq_city, hq_state')
        .or(`name.ilike.${pattern},hq_city.ilike.${pattern},hq_state.ilike.${pattern},notes.ilike.${pattern}`)
        .is('deleted_at', null).limit(8),
      supabase.from('contacts')
        .select('id, first_name, last_name, title, email, phone, mobile_phone, org_id, organizations(name)')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},title.ilike.${pattern},phone.ilike.${pattern},mobile_phone.ilike.${pattern},notes.ilike.${pattern}`)
        .is('deleted_at', null).limit(8),
      supabase.from('deals')
        .select('id, name, stage, vertical, value')
        .is('deleted_at', null)
        .or(`name.ilike.${pattern}`)
        .limit(5),
      supabase.from('properties')
        .select('id, name, city, state, org_id, organizations(name)')
        .or(`name.ilike.${pattern},city.ilike.${pattern}`)
        .limit(5),
      supabase.from('projects')
        .select('id, name, status, vertical, organizations(name)')
        .is('deleted_at', null)
        .ilike('name', pattern)
        .limit(5),
      supabase.from('tasks')
        .select('id, title, status, type, due_date, contacts(first_name, last_name)')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .is('deleted_at', null)
        .limit(5),
      supabase.from('activities')
        .select('id, type, subject, contacts(first_name, last_name), occurred_at')
        .or(`subject.ilike.${pattern},body.ilike.${pattern}`)
        .order('occurred_at', { ascending: false })
        .limit(5),
      supabase.from('email_interactions')
        .select('id, subject, from_email, to_email, direction, received_at, contacts(first_name, last_name)')
        .or(`subject.ilike.${pattern},from_email.ilike.${pattern},to_email.ilike.${pattern}`)
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(5),
    ])

    // Also search orgs by contact company name
    const orgContactResults: any[] = []
    if (words.length > 0) {
      const { data: orgByContact } = await supabase.from('organizations')
        .select('id, name, vertical, hq_city, hq_state')
        .ilike('name', fullPattern)
        .is('deleted_at', null).limit(3)
      if (orgByContact) orgContactResults.push(...orgByContact)
    }

    // Score function: how many search words match the result text
    function score(text: string): number {
      const lower = text.toLowerCase()
      return words.reduce((s, w) => s + (lower.includes(w.toLowerCase()) ? 1 : 0), 0)
    }

    const allResults = [
      ...(contacts.data || []).map(c => ({
        type: 'contact' as const, id: c.id,
        title: `${c.first_name} ${c.last_name}`,
        subtitle: [c.title, (c.organizations as any)?.name, c.email].filter(Boolean).join(' · '),
        href: `/contacts/${c.id}`,
        _score: score(`${c.first_name} ${c.last_name} ${c.title || ''} ${c.email || ''} ${(c.organizations as any)?.name || ''}`),
      })),
      ...(orgs.data || []).concat(orgContactResults).filter((o, i, arr) => arr.findIndex(x => x.id === o.id) === i).map(o => ({
        type: 'organization' as const, id: o.id,
        title: o.name,
        subtitle: [o.vertical?.replace('_', ' '), o.hq_city, o.hq_state].filter(Boolean).join(' · '),
        href: `/organizations/${o.id}`,
        _score: score(`${o.name} ${o.hq_city || ''} ${o.hq_state || ''}`),
      })),
      ...(deals.data || []).map(d => ({
        type: 'deal' as const, id: d.id,
        title: d.name,
        subtitle: [d.stage?.replace('_', ' '), d.vertical?.replace('_', ' '), d.value ? `$${Number(d.value).toLocaleString()}` : null].filter(Boolean).join(' · '),
        href: `/deals/${d.id}`,
        _score: score(d.name),
      })),
      ...(properties.data || []).map(p => ({
        type: 'property' as const, id: p.id,
        title: p.name,
        subtitle: [p.city, p.state, (p.organizations as any)?.name].filter(Boolean).join(' · '),
        href: `/properties/${p.id}`,
        _score: score(`${p.name} ${p.city || ''}`),
      })),
      ...(projects.data || []).map(p => ({
        type: 'project' as const, id: p.id,
        title: p.name,
        subtitle: [p.status?.replace('_', ' '), (p.organizations as any)?.name].filter(Boolean).join(' · '),
        href: `/projects/${p.id}`,
        _score: score(p.name),
      })),
      ...(tasks.data || []).map(t => {
        const contact = t.contacts ? `${(t.contacts as any).first_name} ${(t.contacts as any).last_name}` : ''
        return {
          type: 'task' as const, id: t.id,
          title: t.title,
          subtitle: [t.status, t.type?.replace('_', ' '), contact, t.due_date].filter(Boolean).join(' · '),
          href: `/tasks/${t.id}`,
          _score: score(`${t.title} ${contact}`),
        }
      }),
      ...(activities.data || []).map(a => {
        const contact = a.contacts ? `${(a.contacts as any).first_name} ${(a.contacts as any).last_name}` : ''
        return {
          type: 'activity' as const, id: a.id,
          title: a.subject,
          subtitle: [a.type, contact, a.occurred_at ? new Date(a.occurred_at).toLocaleDateString() : ''].filter(Boolean).join(' · '),
          href: `/activities`,
          _score: score(`${a.subject} ${contact}`),
        }
      }),
      ...(emails.data || []).map(e => {
        const contact = e.contacts ? `${(e.contacts as any).first_name} ${(e.contacts as any).last_name}` : ''
        const emailDisplay = e.direction === 'inbound' ? `From: ${e.from_email}` : `To: ${(e as any).to_email}`
        return {
          type: 'email' as const, id: e.id,
          title: e.subject,
          subtitle: [emailDisplay, contact, new Date(e.received_at).toLocaleDateString()].filter(Boolean).join(' · '),
          href: `/emails`,
          _score: score(`${e.subject} ${e.from_email} ${(e as any).to_email} ${contact}`),
        }
      }),
    ]

    // Sort by score (most relevant first), then by type priority
    const typePriority: Record<string, number> = { contact: 0, organization: 1, deal: 2, task: 3, project: 4, property: 5, activity: 6, email: 7 }
    allResults.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score
      return (typePriority[a.type] || 99) - (typePriority[b.type] || 99)
    })

    return NextResponse.json({ results: allResults.slice(0, 20) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
