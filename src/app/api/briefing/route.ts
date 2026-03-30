import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { nowInTimezone, todayInTimezone, tomorrowInTimezone } from '@/lib/timezone'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, last_login_at, timezone')
    .eq('id', user.id)
    .single()

  const userTz = profile?.timezone || 'America/New_York'
  const userNow = nowInTimezone(userTz)
  const now = new Date()
  const lastLogin = profile?.last_login_at ? new Date(profile.last_login_at) : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const hoursSinceLogin = Math.round((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60))
  const dayOfWeek = userNow.weekday
  const isMonday = dayOfWeek === 'Monday'
  const isFriday = dayOfWeek === 'Friday'

  // Determine lookback window based on time away
  const lookbackHours = Math.max(hoursSinceLogin, 24)
  const lookbackDate = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString()
  const today = todayInTimezone(userTz)
  const tomorrow = tomorrowInTimezone(userTz)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Gather all context in parallel
  const [
    myTasksDueToday,
    myOverdueTasks,
    tasksAssignedToMe,
    recentDealMoves,
    dealsWon,
    dealsLost,
    outreachDue,
    projectChanges,
    newContacts,
    dormantOrgs,
    myActiveDeals,
    myPendingTasks,
    unrepliedEmails,
    staleDeals,
  ] = await Promise.all([
    // Tasks due today assigned to me
    supabase.from('tasks')
      .select('id, title, priority')
      .eq('assigned_to', user.id).eq('status', 'pending').eq('due_date', today)
      .is('deleted_at', null).limit(10),

    // Overdue tasks assigned to me
    supabase.from('tasks')
      .select('id, title, priority, due_date')
      .eq('assigned_to', user.id).eq('status', 'pending').lt('due_date', today)
      .is('deleted_at', null).limit(10),

    // Tasks assigned to me since last login
    supabase.from('tasks')
      .select('id, title, priority, created_by')
      .eq('assigned_to', user.id).eq('status', 'pending')
      .gte('created_at', lookbackDate).neq('created_by', user.id)
      .is('deleted_at', null).limit(10),

    // Deals that moved stages since last login
    supabase.from('activities')
      .select('id, subject, deal_id, deals:deal_id(name, stage)')
      .gte('created_at', lookbackDate)
      .ilike('subject', '%moved to%')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(10),

    // Deals won since last login
    supabase.from('deals')
      .select('id, name, value, vertical')
      .eq('stage', 'awarded').gte('updated_at', lookbackDate)
      .is('deleted_at', null).limit(5),

    // Deals lost since last login
    supabase.from('deals')
      .select('id, name, vertical')
      .eq('stage', 'lost').gte('updated_at', lookbackDate)
      .is('deleted_at', null).limit(5),

    // Outreach actions due
    supabase.from('sequence_enrollments')
      .select('id, contacts:contact_id(first_name, last_name), sequences:sequence_id(name)')
      .eq('status', 'active').lte('next_action_at', tomorrow)
      .limit(10),

    // Project status changes since last login
    supabase.from('projects')
      .select('id, name, status')
      .gte('updated_at', lookbackDate)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }).limit(5),

    // New contacts added since last login
    supabase.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', lookbackDate)
      .is('deleted_at', null),

    // Dormant orgs (60+ days no activity)
    supabase.from('organizations')
      .select('id, name, last_activity_at')
      .not('last_activity_at', 'is', null).lt('last_activity_at', sixtyDaysAgo)
      .is('deleted_at', null).limit(5),

    // My active deals (all non-terminal deals, not just assigned to me)
    supabase.from('deals')
      .select('id, name, stage, value, assigned_to')
      .not('stage', 'in', '("awarded","lost")')
      .is('deleted_at', null),

    // My total pending tasks
    supabase.from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id).eq('status', 'pending')
      .is('deleted_at', null),

    // Unreplied emails
    supabase.from('email_interactions')
      .select('id, subject, from_email, received_at, contacts(first_name, last_name)')
      .eq('user_id', user.id).eq('needs_reply', true).is('replied_at', null)
      .order('received_at', { ascending: true }).limit(5),

    // Stale deals (no activity in 14+ days)
    supabase.from('deals')
      .select('id, name, stage, value, updated_at')
      .not('stage', 'in', '("awarded","lost")')
      .is('deleted_at', null)
      .lt('updated_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: true }).limit(5),
  ])

  // Build context object for AI
  const context = {
    userName: profile?.full_name?.split(' ')[0] || 'there',
    dayOfWeek,
    isMonday,
    isFriday,
    hoursSinceLogin,
    tasksDueToday: (myTasksDueToday.data || []).map(t => ({ id: t.id, title: t.title, priority: t.priority })),
    overdueTasks: (myOverdueTasks.data || []).map(t => ({ id: t.id, title: t.title, daysOverdue: Math.round((now.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)) })),
    newTasksAssigned: (tasksAssignedToMe.data || []).map(t => ({ id: t.id, title: t.title })),
    dealMoves: (recentDealMoves.data || []).filter(a => a.deal_id).map(a => ({
      dealId: a.deal_id, dealName: (a as any).deals?.name || 'Deal', stage: (a as any).deals?.stage || '',
    })),
    dealsWon: (dealsWon.data || []).map(d => ({ id: d.id, name: d.name, value: d.value })),
    dealsLost: (dealsLost.data || []).map(d => ({ id: d.id, name: d.name })),
    outreachDue: (outreachDue.data || []).map(e => ({
      contactName: `${(e as any).contacts?.first_name || ''} ${(e as any).contacts?.last_name || ''}`.trim(),
    })),
    projectUpdates: (projectChanges.data || []).map(p => ({ id: p.id, name: p.name, status: p.status })),
    newContactsCount: newContacts.count || 0,
    dormantOrgs: (dormantOrgs.data || []).map(o => ({
      id: o.id, name: o.name,
      daysDormant: Math.round((now.getTime() - new Date(o.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    myActiveDealCount: myActiveDeals.data?.length || 0,
    myActiveDealValue: (myActiveDeals.data || []).reduce((s, d) => s + (Number(d.value) || 0), 0),
    myActiveDealNames: (myActiveDeals.data || []).slice(0, 5).map(d => d.name),
    myPendingTaskCount: myPendingTasks.count || 0,
    unrepliedEmails: (unrepliedEmails.data || []).map(e => ({
      subject: e.subject, from: e.from_email,
      contact: e.contacts ? `${(e.contacts as any).first_name} ${(e.contacts as any).last_name}` : null,
      daysWaiting: Math.round((now.getTime() - new Date(e.received_at).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    staleDeals: (staleDeals.data || []).map(d => ({
      id: d.id, name: d.name, stage: d.stage?.replace(/_/g, ' '),
      value: d.value, daysSinceUpdate: Math.round((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
    })),
  }

  // Generate AI briefing
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    // Fallback: return structured data without AI summary
    return NextResponse.json({ items: buildFallbackItems(context), generated: false })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are a CRM briefing assistant for ONE70 Group, a commercial construction company. Generate a personalized briefing for ${context.userName} as a JSON array of actionable bullet items.

CONTEXT (${context.dayOfWeek}, ${context.hoursSinceLogin}h since last login):
${JSON.stringify(context, null, 2)}

RULES:
- Return ONLY a JSON array, no other text or markdown
- Each item: { "text": "brief actionable text", "link": "/crm-path", "priority": "high|medium|low", "icon": "emoji" }
- Use these link patterns: /tasks (tasks), /tasks/[id] (specific task), /deals (pipeline), /deals/[id] (specific deal), /outreach (outreach queue), /projects/[id] (specific project), /organizations/[id] (specific org), /contacts (contacts)
- HIGH priority: overdue tasks, tasks due today, deals won/lost, unreplied emails waiting 3+ days, items needing immediate action
- MEDIUM priority: deal stage moves, stale deals (14+ days no movement), new assignments, outreach due, project updates
- LOW priority: dormant orgs, new contacts added, general stats
- ALWAYS mention unreplied emails if any exist — these are relationship risks
- ALWAYS mention stale deals — flag them with how many days stuck
- Keep each text under 80 characters
- Maximum 8 items, minimum 2
- Most important items first
- ${context.isMonday ? 'It is Monday — include a brief week-ahead note' : ''}
- ${context.isFriday ? 'It is Friday — include a brief week-wrap note' : ''}
- If nothing notable happened, give 2-3 items about current state (pending tasks, active deals, outreach due)
- Be direct and specific — use deal names, task names, contact names when available
- Do NOT use generic filler like "stay productive" or "keep up the great work"`,
        }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ items: buildFallbackItems(context), generated: false })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
    const items = JSON.parse(cleaned)

    return NextResponse.json({ items, generated: true })
  } catch (err) {
    console.error('Briefing AI error:', err)
    return NextResponse.json({ items: buildFallbackItems(context), generated: false })
  }
}

// Fallback when AI is not available
function buildFallbackItems(ctx: any) {
  const items: any[] = []

  if (ctx.overdueTasks.length > 0) {
    items.push({ text: `${ctx.overdueTasks.length} overdue task${ctx.overdueTasks.length > 1 ? 's' : ''} need attention`, link: '/tasks', priority: 'high', icon: '🔴' })
  }
  if (ctx.tasksDueToday.length > 0) {
    items.push({ text: `${ctx.tasksDueToday.length} task${ctx.tasksDueToday.length > 1 ? 's' : ''} due today`, link: '/tasks', priority: 'high', icon: '📋' })
  }
  if (ctx.dealsWon.length > 0) {
    ctx.dealsWon.forEach((d: any) => items.push({ text: `Deal won: ${d.name}`, link: `/deals/${d.id}`, priority: 'high', icon: '🎉' }))
  }
  if (ctx.dealsLost.length > 0) {
    ctx.dealsLost.forEach((d: any) => items.push({ text: `Deal lost: ${d.name}`, link: `/deals/${d.id}`, priority: 'high', icon: '❌' }))
  }
  if (ctx.newTasksAssigned.length > 0) {
    items.push({ text: `${ctx.newTasksAssigned.length} new task${ctx.newTasksAssigned.length > 1 ? 's' : ''} assigned to you`, link: '/tasks', priority: 'medium', icon: '📌' })
  }
  if (ctx.outreachDue.length > 0) {
    items.push({ text: `${ctx.outreachDue.length} outreach action${ctx.outreachDue.length > 1 ? 's' : ''} due`, link: '/outreach', priority: 'medium', icon: '📧' })
  }
  if (ctx.unrepliedEmails?.length > 0) {
    const oldest = ctx.unrepliedEmails[0]
    items.push({ text: `${ctx.unrepliedEmails.length} email${ctx.unrepliedEmails.length > 1 ? 's' : ''} awaiting reply${oldest.daysWaiting > 0 ? ` (oldest: ${oldest.daysWaiting}d)` : ''}`, link: '/emails', priority: 'high', icon: '📬' })
  }
  if (ctx.staleDeals?.length > 0) {
    items.push({ text: `${ctx.staleDeals.length} deal${ctx.staleDeals.length > 1 ? 's' : ''} stalled 14+ days — need attention`, link: '/deals', priority: 'medium', icon: '⏳' })
  }
  if (ctx.dormantOrgs.length > 0) {
    items.push({ text: `${ctx.dormantOrgs.length} account${ctx.dormantOrgs.length > 1 ? 's' : ''} need re-engagement`, link: '/organizations', priority: 'low', icon: '⚠️' })
  }
  if (items.length === 0) {
    items.push({ text: `${ctx.myPendingTaskCount} pending tasks, ${ctx.myActiveDealCount} active deals`, link: '/tasks', priority: 'low', icon: '✅' })
  }

  return items.slice(0, 8)
}
