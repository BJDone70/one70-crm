import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { todayInTimezone, tomorrowInTimezone, nowInTimezone } from '@/lib/timezone'

export const runtime = 'nodejs'
export const maxDuration = 60

// Smart fuzzy search helper — splits query into words, matches across fields
function buildFuzzyFilter(query: string, fields: string[]): string {
  const words = query.trim().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return ''
  // Each word must match at least one field
  const conditions = words.map(word => {
    const fieldMatches = fields.map(f => `${f}.ilike.%${word}%`)
    return fieldMatches.join(',')
  })
  // For single word, simple OR across fields
  if (conditions.length === 1) return conditions[0]
  // For multiple words, we return the first word's conditions (Supabase .or() is flat)
  // We'll handle multi-word in the executeTool function with post-filtering
  return conditions[0]
}

const TOOLS = [
  {
    name: 'search_contacts',
    description: 'Search for contacts by name, company, email, title, or phone. Use this whenever the user mentions a person, asks to find someone, or needs contact info. Works with partial names, first name only, last name only, or company name.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — can be a partial name, full name, company, email, title, or phone number. Examples: "John", "Smith at Hilton", "hotel manager", "john.smith@"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_deals',
    description: 'Search for deals in the pipeline by name, stage, vertical, organization, or contact. Use when asking about deals, pipeline, opportunities, or projects in the sales process.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — deal name, org name, contact name, or keyword' },
        stage: { type: 'string', enum: ['new_lead', 'contacted', 'qualified', 'estimating', 'proposal_sent', 'negotiation', 'awarded', 'lost'], description: 'Filter by stage' },
        vertical: { type: 'string', description: 'Filter by vertical (e.g. multifamily, hotel, senior_living, or any custom vertical)' },
      },
      required: [],
    },
  },
  {
    name: 'search_organizations',
    description: 'Search for organizations/companies by name, vertical, city, or state. Use when the user asks about a company, client, or organization.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — org name, city, state, or keyword' },
        vertical: { type: 'string', description: 'Filter by vertical' },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task or follow-up. Use when the user asks to create, add, schedule, or remind about a task, follow-up, call, meeting, or to-do item.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional details' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        type: { type: 'string', enum: ['follow_up', 'call', 'meeting', 'site_visit', 'proposal', 'other'] },
        contact_name: { type: 'string', description: 'Name of contact to link (fuzzy matched)' },
        org_name: { type: 'string', description: 'Name of organization to link (fuzzy matched)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'log_activity',
    description: 'Log a note, call, email, or meeting on a contact or organization. Use when the user says "log", "note", "record", or describes an interaction that happened.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['note', 'call', 'email', 'meeting'] },
        subject: { type: 'string', description: 'Brief subject line' },
        body: { type: 'string', description: 'Details of the interaction' },
        contact_name: { type: 'string', description: 'Contact name (fuzzy matched)' },
        org_name: { type: 'string', description: 'Organization name (fuzzy matched)' },
      },
      required: ['type', 'subject', 'body'],
    },
  },
  {
    name: 'move_deal_stage',
    description: 'Move a deal to a different pipeline stage.',
    input_schema: {
      type: 'object',
      properties: {
        deal_name: { type: 'string', description: 'Name or partial name of the deal' },
        new_stage: { type: 'string', enum: ['new_lead', 'contacted', 'qualified', 'estimating', 'proposal_sent', 'negotiation', 'awarded', 'lost'] },
      },
      required: ['deal_name', 'new_stage'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact in the CRM.',
    input_schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        title: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        mobile_phone: { type: 'string' },
        company: { type: 'string', description: 'Company name — will be matched or created' },
      },
      required: ['first_name', 'last_name'],
    },
  },
  {
    name: 'get_my_tasks',
    description: 'Get the current user\'s pending tasks. Use for "what are my tasks", "what do I need to do", "what\'s due today".',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['due_today', 'overdue', 'all_pending', 'high_priority'] },
      },
      required: [],
    },
  },
  {
    name: 'get_outreach_due',
    description: 'Get outreach/sequence actions that are due.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the deal pipeline — counts and values by stage.',
    input_schema: {
      type: 'object',
      properties: {
        vertical: { type: 'string', description: 'Optional vertical filter' },
      },
      required: [],
    },
  },
  {
    name: 'search_projects',
    description: 'Search for active projects by name, status, vertical, or type.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — project name or keyword' },
      },
      required: [],
    },
  },
  {
    name: 'get_recent_activities',
    description: 'Get recent activities (calls, emails, meetings, notes) across the CRM. Use when asking "what happened recently" or "any recent activity".',
    input_schema: {
      type: 'object',
      properties: {
        contact_name: { type: 'string', description: 'Optional — filter activities for a specific contact' },
        days: { type: 'number', description: 'How many days back to look (default 7)' },
      },
      required: [],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. ALWAYS use this for weather, news, current events, company research, market data, industry info, or anything not in the CRM database.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Web search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_emails',
    description: 'Search the user\'s Microsoft 365 Outlook inbox. Use when asked about emails, messages from someone, or "check my email". Returns recent emails matching the query.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term — person name, subject, or keyword. Use empty string for recent emails.' },
        sender_email: { type: 'string', description: 'Filter by sender email address (optional)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_calendar',
    description: 'Search the user\'s Microsoft 365 Outlook calendar. Use when asked about meetings, schedule, calendar, availability, or "what do I have today/this week".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or empty for all events in range' },
        start_date: { type: 'string', description: 'Start date (ISO format or natural: "today", "tomorrow")' },
        end_date: { type: 'string', description: 'End date (ISO format or natural: "this friday", "next week")' },
      },
      required: [],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via the user\'s Microsoft 365 account. Use when asked to "send an email to [person]", "email [person] about [topic]", or "draft and send". Always confirm the content with the user before sending unless they explicitly said to send it.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (plain text — will be converted to HTML)' },
        contact_name: { type: 'string', description: 'Name of the contact (for CRM lookup to log the activity)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
]

// Smart contact resolver — tries multiple strategies
async function resolveContact(name: string, supabase: any): Promise<{ id: string; name: string } | null> {
  if (!name) return null
  const words = name.trim().split(/\s+/)

  // Strategy 1: Full name match (first + last)
  if (words.length >= 2) {
    const { data } = await supabase.from('contacts')
      .select('id, first_name, last_name')
      .ilike('first_name', `%${words[0]}%`)
      .ilike('last_name', `%${words[words.length - 1]}%`)
      .is('deleted_at', null).limit(1)
    if (data?.[0]) return { id: data[0].id, name: `${data[0].first_name} ${data[0].last_name}` }
  }

  // Strategy 2: Any word matches first or last name
  for (const word of words) {
    if (word.length < 2) continue
    const { data } = await supabase.from('contacts')
      .select('id, first_name, last_name')
      .or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
      .is('deleted_at', null).limit(3)
    if (data?.length === 1) return { id: data[0].id, name: `${data[0].first_name} ${data[0].last_name}` }
  }

  // Strategy 3: Search by company name
  const { data: orgMatch } = await supabase.from('organizations')
    .select('id').ilike('name', `%${name}%`).is('deleted_at', null).limit(1)
  if (orgMatch?.[0]) {
    const { data: contactByOrg } = await supabase.from('contacts')
      .select('id, first_name, last_name')
      .eq('org_id', orgMatch[0].id).is('deleted_at', null).limit(1)
    if (contactByOrg?.[0]) return { id: contactByOrg[0].id, name: `${contactByOrg[0].first_name} ${contactByOrg[0].last_name}` }
  }

  return null
}

// Smart org resolver
async function resolveOrg(name: string, supabase: any): Promise<{ id: string; name: string } | null> {
  if (!name) return null
  const words = name.trim().split(/\s+/)

  // Strategy 1: Direct ilike
  const { data } = await supabase.from('organizations')
    .select('id, name').ilike('name', `%${name}%`).is('deleted_at', null).limit(1)
  if (data?.[0]) return { id: data[0].id, name: data[0].name }

  // Strategy 2: Each word
  for (const word of words) {
    if (word.length < 3) continue
    const { data: d } = await supabase.from('organizations')
      .select('id, name').ilike('name', `%${word}%`).is('deleted_at', null).limit(3)
    if (d?.length === 1) return { id: d[0].id, name: d[0].name }
  }

  return null
}

function titleCase(s: string) {
  return s.trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ')
}

async function executeTool(toolName: string, input: any, userId: string, supabase: any, userTz: string): Promise<any> {
  const today = todayInTimezone(userTz)
  const tomorrow = tomorrowInTimezone(userTz)

  switch (toolName) {
    case 'search_contacts': {
      const q = input.query?.trim() || ''
      const words = q.split(/\s+/).filter((w: string) => w.length > 1)

      // Search across all relevant fields with each word
      let allResults: any[] = []
      for (const word of words.slice(0, 3)) {
        const { data } = await supabase.from('contacts')
          .select('id, first_name, last_name, title, email, phone, mobile_phone, is_decision_maker, is_prime_contact, organizations:org_id(name, vertical)')
          .or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,email.ilike.%${word}%,title.ilike.%${word}%,phone.ilike.%${word}%`)
          .is('deleted_at', null).limit(20)
        if (data) allResults.push(...data)
      }

      // Also search by organization name
      if (q) {
        const { data: orgs } = await supabase.from('organizations')
          .select('id').ilike('name', `%${q}%`).is('deleted_at', null).limit(5)
        if (orgs?.length) {
          const orgIds = orgs.map((o: any) => o.id)
          const { data: orgContacts } = await supabase.from('contacts')
            .select('id, first_name, last_name, title, email, phone, mobile_phone, is_decision_maker, is_prime_contact, organizations:org_id(name, vertical)')
            .in('org_id', orgIds).is('deleted_at', null).limit(20)
          if (orgContacts) allResults.push(...orgContacts)
        }
      }

      // Deduplicate and score results
      const seen = new Set()
      const unique = allResults.filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })

      // Score — more word matches = higher score
      const scored = unique.map(c => {
        const haystack = `${c.first_name} ${c.last_name} ${c.title || ''} ${c.email || ''} ${(c.organizations as any)?.name || ''}`.toLowerCase()
        const score = words.reduce((s: number, w: string) => s + (haystack.includes(w.toLowerCase()) ? 1 : 0), 0)
        return { ...c, _score: score }
      }).sort((a, b) => b._score - a._score).slice(0, 10)

      return { contacts: scored, count: scored.length }
    }

    case 'search_deals': {
      let query = supabase.from('deals')
        .select('id, name, stage, value, vertical, expected_close, organizations:org_id(name), contacts:contact_id(first_name, last_name)')
        .is('deleted_at', null)
      if (input.stage) query = query.eq('stage', input.stage)
      if (input.vertical) query = query.eq('vertical', input.vertical)
      if (input.query) {
        const words = input.query.split(/\s+/).filter((w: string) => w.length > 1)
        if (words[0]) query = query.or(`name.ilike.%${words[0]}%`)
      }
      const { data } = await query.order('updated_at', { ascending: false }).limit(10)
      return { deals: data || [], count: data?.length || 0 }
    }

    case 'search_organizations': {
      const q = input.query?.trim() || ''
      const words = q.split(/\s+/).filter((w: string) => w.length > 1)
      let allResults: any[] = []

      for (const word of words.slice(0, 3)) {
        const { data } = await supabase.from('organizations')
          .select('id, name, vertical, hq_city, hq_state, phone, website')
          .or(`name.ilike.%${word}%,hq_city.ilike.%${word}%,hq_state.ilike.%${word}%`)
          .is('deleted_at', null).limit(10)
        if (data) allResults.push(...data)
      }

      if (input.vertical) {
        allResults = allResults.filter(o => o.vertical === input.vertical)
      }

      const seen = new Set()
      const unique = allResults.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true }).slice(0, 10)
      return { organizations: unique, count: unique.length }
    }

    case 'create_task': {
      const contact = await resolveContact(input.contact_name, supabase)
      const org = await resolveOrg(input.org_name, supabase)
      const { data, error } = await supabase.from('tasks').insert({
        title: input.title, description: input.description || null,
        due_date: input.due_date || null, priority: input.priority || 'medium',
        type: input.type || 'follow_up', contact_id: contact?.id || null,
        org_id: org?.id || null, assigned_to: userId, created_by: userId, status: 'pending',
      }).select().single()
      if (error) return { error: error.message }
      return { success: true, task: data, message: `Task created: "${input.title}"${contact ? ` (linked to ${contact.name})` : ''}`, link: `/tasks` }
    }

    case 'log_activity': {
      const contact = await resolveContact(input.contact_name, supabase)
      const org = await resolveOrg(input.org_name, supabase)
      const { error } = await supabase.from('activities').insert({
        type: input.type, subject: input.subject, body: input.body,
        contact_id: contact?.id || null, org_id: org?.id || null,
        user_id: userId, direction: 'outbound',
      })
      if (error) return { error: error.message }
      return { success: true, message: `Logged ${input.type}: "${input.subject}"${contact ? ` for ${contact.name}` : ''}` }
    }

    case 'move_deal_stage': {
      const words = (input.deal_name || '').split(/\s+/).filter((w: string) => w.length > 1)
      let dealQuery = supabase.from('deals').select('id, name, stage').is('deleted_at', null)
      if (words[0]) dealQuery = dealQuery.ilike('name', `%${words[0]}%`)
      const { data: deals } = await dealQuery.limit(5)

      if (!deals?.length) return { error: `No deal found matching "${input.deal_name}"` }
      // Best match
      const deal = deals[0]
      const { error } = await supabase.from('deals').update({ stage: input.new_stage }).eq('id', deal.id)
      if (error) return { error: error.message }
      return { success: true, message: `Moved "${deal.name}" to ${input.new_stage.replace(/_/g, ' ')}`, link: `/deals/${deal.id}` }
    }

    case 'create_contact': {
      const firstName = titleCase(input.first_name)
      const lastName = titleCase(input.last_name)
      let orgId = null
      if (input.company) {
        const org = await resolveOrg(input.company, supabase)
        if (org) { orgId = org.id }
        else {
          // Get first vertical from DB as default
          const { data: vData } = await supabase.from('custom_verticals').select('name').limit(1)
          const defaultVertical = vData?.[0]?.name || 'general'
          const { data: newOrg } = await supabase.from('organizations').insert({ name: input.company, vertical: defaultVertical }).select('id').single()
          if (newOrg) orgId = newOrg.id
        }
      }
      const { data, error } = await supabase.from('contacts').insert({
        first_name: firstName, last_name: lastName, title: input.title || null,
        email: input.email || null, phone: input.phone || null,
        mobile_phone: input.mobile_phone || null, org_id: orgId,
      }).select().single()
      if (error) return { error: error.message }
      return { success: true, message: `Created contact: ${firstName} ${lastName}`, link: `/contacts/${data.id}` }
    }

    case 'get_my_tasks': {
      let query = supabase.from('tasks')
        .select('id, title, type, priority, due_date, contacts:contact_id(first_name, last_name), organizations:org_id(name)')
        .eq('assigned_to', userId).eq('status', 'pending').is('deleted_at', null)

      if (input.filter === 'due_today') query = query.eq('due_date', today)
      else if (input.filter === 'overdue') query = query.lt('due_date', today)
      else if (input.filter === 'high_priority') query = query.eq('priority', 'high')

      const { data } = await query.order('due_date', { ascending: true, nullsFirst: false }).limit(15)
      return { tasks: data || [], count: data?.length || 0 }
    }

    case 'get_outreach_due': {
      const { data } = await supabase.from('sequence_enrollments')
        .select('id, current_step, contacts:contact_id(first_name, last_name), sequences:sequence_id(name)')
        .eq('status', 'active').lte('next_action_at', tomorrow).limit(10)
      return { outreach: data || [], count: data?.length || 0 }
    }

    case 'get_pipeline_summary': {
      let query = supabase.from('deals').select('id, stage, value, vertical').is('deleted_at', null)
      if (input.vertical) query = query.eq('vertical', input.vertical)
      const { data: deals } = await query

      const stages = ['new_lead', 'contacted', 'qualified', 'estimating', 'proposal_sent', 'negotiation']
      const stageLabels: Record<string, string> = {
        new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified',
        estimating: 'Estimating', proposal_sent: 'Proposal Sent', negotiation: 'Negotiation',
      }
      const summary = stages.map(s => {
        const sd = (deals || []).filter((dl: any) => dl.stage === s)
        return { stage: stageLabels[s], count: sd.length, value: sd.reduce((sum: number, dl: any) => sum + (Number(dl.value) || 0), 0) }
      })
      const won = (deals || []).filter((dl: any) => dl.stage === 'awarded')
      const active = (deals || []).filter((dl: any) => !['awarded', 'lost'].includes(dl.stage))
      return {
        pipeline: summary, totalActive: active.length,
        totalValue: active.reduce((s: number, dl: any) => s + (Number(dl.value) || 0), 0),
        wonCount: won.length, wonValue: won.reduce((s: number, dl: any) => s + (Number(dl.value) || 0), 0),
      }
    }

    case 'search_projects': {
      let query = supabase.from('projects')
        .select('id, name, status, vertical, project_type, contract_value, percent_complete')
      if (input.query) {
        const words = input.query.split(/\s+/).filter((w: string) => w.length > 1)
        if (words[0]) query = query.ilike('name', `%${words[0]}%`)
      }
      const { data } = await query.order('name').limit(10)
      return { projects: data || [], count: data?.length || 0 }
    }

    case 'get_recent_activities': {
      const daysBack = input.days || 7
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
      let query = supabase.from('activities')
        .select('id, type, subject, body, occurred_at, contacts:contact_id(first_name, last_name), organizations:org_id(name)')
        .gte('occurred_at', since)

      if (input.contact_name) {
        const contact = await resolveContact(input.contact_name, supabase)
        if (contact) query = query.eq('contact_id', contact.id)
      }

      const { data } = await query.order('occurred_at', { ascending: false }).limit(15)
      return { activities: data || [], count: data?.length || 0 }
    }

    case 'web_search': {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicKey) return { result: 'Web search not configured.' }
      try {
        const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'web-search-2025-03-05',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages: [{ role: 'user', content: input.query }],
          }),
        })
        if (!searchRes.ok) {
          const errBody = await searchRes.text().catch(() => '')
          console.error('Web search error:', searchRes.status, errBody.substring(0, 300))
          return { result: `Web search unavailable (${searchRes.status}). Try Google for "${input.query}".` }
        }
        const searchData = await searchRes.json()
        const texts = (searchData.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text)
        return { result: texts[texts.length - 1] || texts[0] || `No results for "${input.query}".` }
      } catch (err: any) {
        console.error('Web search exception:', err.message)
        return { result: `Web search error: ${err.message}` }
      }
    }

    case 'search_emails': {
      try {
        const { getRecentEmails, searchEmailsBySender, isM365Connected } = await import('@/lib/microsoft-graph')
        const connected = await isM365Connected(userId)
        if (!connected) return { result: 'Microsoft 365 not connected. Go to Settings → Integrations → Connect Microsoft 365.' }

        const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        let emails
        if (input.sender_email) {
          emails = await searchEmailsBySender(userId, input.sender_email, input.limit || 10)
        } else if (input.query) {
          // Search by fetching recent and filtering
          const all = await getRecentEmails(userId, sinceDate, 50)
          const q = input.query.toLowerCase()
          emails = all.filter((e: any) =>
            (e.subject || '').toLowerCase().includes(q) ||
            (e.from?.emailAddress?.address || '').toLowerCase().includes(q) ||
            (e.from?.emailAddress?.name || '').toLowerCase().includes(q) ||
            (e.bodyPreview || '').toLowerCase().includes(q)
          ).slice(0, input.limit || 10)
        } else {
          emails = await getRecentEmails(userId, sinceDate, input.limit || 10)
        }

        if (!emails?.length) return { result: 'No emails found matching your search.' }
        return {
          result: `Found ${emails.length} email(s):\n${emails.map((e: any, i: number) =>
            `${i + 1}. From: ${e.from?.emailAddress?.name || e.from?.emailAddress?.address || 'Unknown'} | Subject: ${e.subject || 'No subject'} | ${new Date(e.receivedDateTime).toLocaleString()} | ${e.isRead ? 'Read' : 'UNREAD'}\n   Preview: ${(e.bodyPreview || '').substring(0, 120)}`
          ).join('\n')}`
        }
      } catch (err: any) {
        return { result: `Email search error: ${err.message}` }
      }
    }

    case 'search_calendar': {
      try {
        const { getCalendarEvents, isM365Connected } = await import('@/lib/microsoft-graph')
        const connected = await isM365Connected(userId)
        if (!connected) return { result: 'Microsoft 365 not connected. Go to Settings → Integrations → Connect Microsoft 365.' }

        const now = new Date()
        let startDate = input.start_date || now.toISOString()
        let endDate = input.end_date || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

        // Handle natural language dates
        const lower = (input.start_date || '').toLowerCase()
        if (lower === 'today' || lower === '') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        if (lower === 'tomorrow') { const t = new Date(now); t.setDate(t.getDate() + 1); startDate = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString() }

        const endLower = (input.end_date || '').toLowerCase()
        if (endLower === 'today' || endLower === 'tonight') endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
        if (endLower === 'tomorrow') { const t = new Date(now); t.setDate(t.getDate() + 2); endDate = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString() }
        if (endLower.includes('week')) endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

        const events = await getCalendarEvents(userId, startDate, endDate, 20)
        if (!events?.length) return { result: 'No calendar events found in that range.' }

        // Filter by query if provided
        let filtered = events
        if (input.query) {
          const q = input.query.toLowerCase()
          filtered = events.filter((e: any) =>
            (e.subject || '').toLowerCase().includes(q) ||
            (e.attendees || []).some((a: any) => (a.emailAddress?.name || '').toLowerCase().includes(q))
          )
        }

        if (!filtered.length) return { result: 'No matching calendar events found.' }
        return {
          result: `Found ${filtered.length} event(s):\n${filtered.map((e: any, i: number) => {
            const start = new Date(e.start?.dateTime + 'Z')
            const end = new Date(e.end?.dateTime + 'Z')
            const attendees = (e.attendees || []).map((a: any) => a.emailAddress?.name || a.emailAddress?.address).join(', ')
            const loc = e.location?.displayName || ''
            return `${i + 1}. ${e.subject || 'No title'} | ${start.toLocaleString()} - ${end.toLocaleTimeString()} | ${loc ? `Location: ${loc}` : ''}${attendees ? ` | With: ${attendees}` : ''}`
          }).join('\n')}`
        }
      } catch (err: any) {
        return { result: `Calendar search error: ${err.message}` }
      }
    }

    case 'send_email': {
      try {
        const { sendEmail, isM365Connected } = await import('@/lib/microsoft-graph')
        const connected = await isM365Connected(userId)
        if (!connected) return { result: 'Microsoft 365 not connected. Go to Settings → Integrations → Connect Microsoft 365.' }

        // Try to resolve contact for CRM logging
        let contactId = null
        let orgId = null
        if (input.contact_name) {
          const contact = await resolveContact(input.contact_name, supabase)
          if (contact) {
            contactId = contact.id
            const { data: c } = await supabase.from('contacts').select('org_id').eq('id', contact.id).single()
            orgId = c?.org_id
          }
        }

        await sendEmail(userId, [input.to], input.subject, input.body.replace(/\n/g, '<br>'))

        // Log as activity
        await supabase.from('activities').insert({
          type: 'email', subject: `Sent: ${input.subject}`,
          body: `To: ${input.to}`, contact_id: contactId, org_id: orgId, user_id: userId, direction: 'outbound',
        })

        // Log as email interaction if contact found
        if (contactId) {
          await supabase.from('email_interactions').insert({
            user_id: userId, contact_id: contactId, org_id: orgId, direction: 'outbound',
            from_email: '', to_email: input.to, subject: input.subject,
            snippet: input.body.substring(0, 300), received_at: new Date().toISOString(),
            needs_reply: false, source: 'sent_from_crm',
          })
        }

        return { result: `Email sent to ${input.to}: "${input.subject}"` }
      } catch (err: any) {
        return { result: `Failed to send email: ${err.message}` }
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { message, history, pageContext, userName: reqUserName } = await request.json()
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name, role, timezone').eq('id', user.id).single()
  const userTz = profile?.timezone || 'America/New_York'
  const userNow = nowInTimezone(userTz)
  const dateStr = `${userNow.weekday}, ${userNow.month}/${userNow.day}/${userNow.year}`
  const displayName = reqUserName || profile?.full_name || 'the user'
  const firstName = displayName.split(' ')[0]

  // Load page context data if viewing a specific entity
  let contextBlock = ''
  if (pageContext?.type && pageContext.type !== 'other' && pageContext.type !== 'dashboard' && pageContext.id) {
    try {
      const tableMap: Record<string, string> = {
        deal: 'deals', contact: 'contacts', organization: 'organizations', project: 'projects', task: 'tasks', property: 'properties',
      }
      const table = tableMap[pageContext.type]
      if (table) {
        const { data: record } = await supabase.from(table).select('*').eq('id', pageContext.id).single()
        if (record) {
          const safe = { ...record }
          delete safe.deleted_at
          contextBlock = `\n\nCURRENT PAGE CONTEXT — The user is currently viewing a ${pageContext.type} record:\n${JSON.stringify(safe, null, 2)}\n\nUse this context to be proactive. You know what they're looking at — reference it naturally without making the user re-explain.`
        }
      }
    } catch {}
  }

  // Handle proactive greeting
  const isGreeting = message === '__greeting__'
  let greetingPrompt = ''
  if (isGreeting) {
    if (pageContext?.type === 'deal' && pageContext.name) {
      greetingPrompt = `The user just opened the AI assistant while viewing a deal called "${pageContext.name}". Give a brief, proactive greeting that references this deal — mention something useful like how long it's been in its current stage, if any info looks missing, or suggest a next step. Keep it to 2-3 sentences. Address them as ${firstName}.`
    } else if (pageContext?.type === 'contact' && pageContext.name) {
      greetingPrompt = `The user just opened the AI assistant while viewing a contact: "${pageContext.name}". Give a brief greeting and mention something relevant — maybe when they last interacted, if there are open tasks, or suggest reaching out. 2-3 sentences. Address them as ${firstName}.`
    } else if (pageContext?.type === 'organization' && pageContext.name) {
      greetingPrompt = `The user just opened the AI assistant while viewing an organization: "${pageContext.name}". Greet them and offer to help with this org — deals in pipeline, contacts, or anything useful. 2-3 sentences. Address them as ${firstName}.`
    } else {
      greetingPrompt = `The user just opened the AI assistant. Today is ${dateStr}. Give a brief, energetic greeting to ${firstName}. Offer to help — mention you can check their tasks, pipeline, emails, or anything else. Keep it to 2 sentences, be direct and useful, not generic.`
    }
  }

  // Load user's writing style profile
  let styleInstruction = ''
  try {
    const { data: styleData } = await supabase.from('user_style_profiles').select('style_instruction').eq('user_id', user.id).single()
    if (styleData?.style_instruction) {
      styleInstruction = `\n\nWRITING STYLE — When drafting emails, messages, or any written communication for this user, match their personal style:\n${styleData.style_instruction}\n`
    }
  } catch {}

  const systemPrompt = `You are the ONE70 Group executive AI assistant. You work for ${displayName}, helping them manage their commercial construction CRM — contacts, deals, tasks, outreach, projects, and general business needs.

Today is ${dateStr} (${userTz}). The user's role is ${profile?.role || 'member'}.

YOUR CAPABILITIES:
- Search and manage CRM data (contacts, organizations, deals, tasks, projects, activities)
- Create tasks, contacts, log activities, move deals through the pipeline
- Search the web automatically for weather, news, company research, industry data, or any external information
- Answer general business questions, give advice, help with communication drafts

PROACTIVE BEHAVIOR:
- You speak first when the conversation opens — greet the user and offer context-aware help
- When viewing a deal/contact/org, reference what you see and suggest next actions
- Flag risks, gaps, and stale items without being asked
- Push, don't pull — be the one driving the conversation forward

SEARCH BEHAVIOR — THIS IS CRITICAL:
- When the user mentions ANY person, company, or deal — ALWAYS search first, even with partial info
- Use fuzzy matching: "John" should find "John Smith", "Jonathan Miller", etc.
- If the user says "the Hilton deal" search for "Hilton" in deals
- If searching for a person doesn't find results by name, try searching by their company
- When you find multiple matches, present all of them and ask which one
- NEVER say "I couldn't find them" without trying at least 2 different search strategies

CONVERSATIONAL STYLE:
- Be direct and helpful — construction professionals are busy
- After taking an action, confirm what you did concisely
- For search results, present them clearly with key details
- If you can help with something beyond the CRM (drafting an email, researching a company, market analysis), do it
- You have built-in web search capability — use it automatically for weather, news, current events, company research, or anything not in the CRM
- When using web search, provide the complete answer with specific details — don't just say "I'll search"
- You can search the user's Microsoft 365 Outlook inbox and calendar directly. Use search_emails for "check my email", "any emails from [person]", etc. Use search_calendar for "what meetings do I have", "what's my schedule today", etc.
- When asked about emails from a person, just search for their name — don't ask for their email address
- You can SEND emails via send_email — use when asked to "email [person] about [topic]". Look up the contact's email in the CRM first. Always draft the email and confirm with the user before sending unless they explicitly say "send it"
- You are not limited to CRM operations — be a full executive assistant
- If unsure, ask one brief clarifying question rather than guessing wrong${contextBlock}${styleInstruction}`

  const messages: any[] = (history || []).slice(-10).map((m: any) => ({
    role: m.role, content: m.content,
  }))
  messages.push({ role: 'user', content: isGreeting ? greetingPrompt : message })

  try {
    let res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Claude API error:', res.status, errText.substring(0, 500))
      return NextResponse.json({ response: `AI error (${res.status}): ${errText.substring(0, 200)}`, links: [], actions: [] })
    }

    let data = await res.json()
    let responseText = ''
    const actions: any[] = []

    let iterations = 0
    while (iterations < 8) {
      iterations++
      const textBlocks = data.content.filter((b: any) => b.type === 'text')
      const toolBlocks = data.content.filter((b: any) => b.type === 'tool_use')

      if (textBlocks.length > 0) responseText += textBlocks.map((b: any) => b.text).join('\n')
      if (toolBlocks.length === 0 || data.stop_reason !== 'tool_use') break

      const toolResults: any[] = []
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, user.id, supabase, userTz)
        actions.push({ tool: tool.name, input: tool.input, result })
        toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) })
      }

      messages.push({ role: 'assistant', content: data.content })
      messages.push({ role: 'user', content: toolResults })

      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          tools: TOOLS,
          messages,
        }),
      })

      if (!res.ok) {
        console.error('Claude follow-up error:', res.status)
        break
      }
      data = await res.json()
    }

    const finalText = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    if (finalText) responseText = finalText

    // Build clickable links from actions
    const links: any[] = []
    for (const action of actions) {
      if (action.result?.link) links.push({ text: action.result.message || 'View', url: action.result.link })
      if (action.result?.contacts) {
        action.result.contacts.slice(0, 8).forEach((c: any) => {
          const org = (c.organizations as any)?.name ? ` — ${(c.organizations as any).name}` : ''
          links.push({ text: `${c.first_name} ${c.last_name}${c.title ? `, ${c.title}` : ''}${org}`, url: `/contacts/${c.id}` })
        })
      }
      if (action.result?.deals) {
        action.result.deals.slice(0, 8).forEach((d: any) => {
          links.push({ text: `${d.name} (${d.stage?.replace(/_/g, ' ')})${d.value ? ` — $${Number(d.value).toLocaleString()}` : ''}`, url: `/deals/${d.id}` })
        })
      }
      if (action.result?.organizations) {
        action.result.organizations.slice(0, 8).forEach((o: any) => {
          links.push({ text: `${o.name}${o.hq_city ? ` — ${o.hq_city}, ${o.hq_state}` : ''}`, url: `/organizations/${o.id}` })
        })
      }
      if (action.result?.tasks) {
        action.result.tasks.slice(0, 5).forEach((t: any) => {
          const contact = t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : ''
          links.push({ text: `${t.title}${contact ? ` (${contact})` : ''}${t.due_date ? ` — due ${t.due_date}` : ''}`, url: `/tasks` })
        })
      }
      if (action.result?.projects) {
        action.result.projects.slice(0, 5).forEach((p: any) => {
          links.push({ text: `${p.name} (${p.percent_complete || 0}%)`, url: `/projects/${p.id}` })
        })
      }
    }

    // If no response text but we have tool results, use them directly
    if (!responseText.trim()) {
      for (const action of actions) {
        if (action.tool === 'web_search' && action.result?.result) {
          responseText = action.result.result
          break
        }
      }
    }

    return NextResponse.json({
      response: responseText.trim() || 'I processed your request but didn\'t generate a text response. Try rephrasing your question.',
      links: links.slice(0, 12),
      actions: actions.map(a => ({ tool: a.tool, success: !a.result?.error })),
    })
  } catch (err: any) {
    console.error('Assistant error:', err)
    return NextResponse.json({
      response: `Something went wrong: ${err.message || 'Unknown error'}. Please try again.`,
      links: [],
      actions: [],
    })
  }
}
