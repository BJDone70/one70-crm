import { createClient } from '@/lib/supabase/server'
import { Building2, Users, MapPin, Activity, Columns3, Send, AlertTriangle, FolderKanban } from 'lucide-react'
import Link from 'next/link'
import TodoWidget from '@/components/todo-widget'
import DashboardBriefing from '@/components/dashboard-briefing'
import StaleDealsWidget from '@/components/stale-deals-widget'
import UnrepliedEmailsWidget from '@/components/unreplied-emails-widget'
import { ACTIVE_STAGE_IDS, STAGE_LABELS, WON_STAGE, LOST_STAGE, isTerminalStage } from '@/lib/stages'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'
import { todayInTimezone } from '@/lib/timezone'

async function getStats() {
  const supabase = await createClient()
  const [orgs, contacts, properties, activities] = await Promise.all([
    supabase.from('organizations').select('id, vertical', { count: 'exact', head: false }).is('deleted_at', null),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('properties').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('activities').select('id', { count: 'exact', head: true }),
  ])
  const verticalCounts: Record<string, number> = {}
  orgs.data?.forEach(o => {
    if (o.vertical) verticalCounts[o.vertical] = (verticalCounts[o.vertical] || 0) + 1
  })
  return {
    totalOrgs: orgs.count ?? 0, totalContacts: contacts.count ?? 0,
    totalProperties: properties.count ?? 0, totalActivities: activities.count ?? 0, verticalCounts,
  }
}

async function getTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('tasks')
    .select('*, contacts(first_name, last_name), organizations(name)')
    .eq('status', 'pending')
    .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(20)
  return data || []
}

async function getReminders() {
  const supabase = await createClient()
  const { data: { user: remUser } } = await supabase.auth.getUser()
  const { data: remProfile } = remUser
    ? await supabase.from('profiles').select('timezone').eq('id', remUser.id).single()
    : { data: null }
  const today = todayInTimezone(remProfile?.timezone || 'America/New_York')
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data } = await supabase
    .from('key_notes')
    .select('*, contacts(first_name, last_name)')
    .not('reminder_date', 'is', null)
    .gte('reminder_date', today)
    .lte('reminder_date', twoWeeks)
    .order('reminder_date')
    .limit(10)
  return data || []
}

async function getPipelineStats() {
  const supabase = await createClient()
  const { data: deals } = await supabase.from('deals').select('id, stage, value, vertical').is('deleted_at', null)
  if (!deals) return { stages: [], totalActive: 0, totalValue: 0, wonCount: 0, wonValue: 0, byVertical: [] }

  const stageOrder = [...ACTIVE_STAGE_IDS]
  const stageLabels = STAGE_LABELS
  const stages = stageOrder.map(id => {
    const s = deals.filter(d => d.stage === id)
    return { id, label: stageLabels[id], count: s.length, value: s.reduce((sum, d) => sum + (Number(d.value) || 0), 0) }
  })

  const active = deals.filter(d => !isTerminalStage(d.stage))
  const won = deals.filter(d => d.stage === WON_STAGE)

  // Break down by vertical — build dynamically from actual deals
  const BAR_COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500']
  const BORDER_COLORS = ['border-l-blue-500', 'border-l-amber-500', 'border-l-green-500', 'border-l-purple-500', 'border-l-red-500', 'border-l-cyan-500', 'border-l-pink-500']
  const verticalIds = [...new Set(deals.map(d => d.vertical).filter(Boolean))] as string[]
  const verticals = verticalIds.map((id: string, i: number) => ({
    id,
    label: id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    color: BORDER_COLORS[i % BORDER_COLORS.length],
    barColor: BAR_COLORS[i % BAR_COLORS.length],
  }))
  const byVertical = verticals.map(v => {
    const vDeals = deals.filter(d => d.vertical === v.id && !isTerminalStage(d.stage))
    const vWon = deals.filter(d => d.vertical === v.id && d.stage === WON_STAGE)
    const vStages = stageOrder.map(sid => ({
      id: sid,
      label: stageLabels[sid],
      count: deals.filter(d => d.vertical === v.id && d.stage === sid).length,
    }))
    return {
      ...v,
      activeCount: vDeals.length,
      activeValue: vDeals.reduce((s, d) => s + (Number(d.value) || 0), 0),
      wonCount: vWon.length,
      wonValue: vWon.reduce((s, d) => s + (Number(d.value) || 0), 0),
      stages: vStages,
    }
  })

  return {
    stages, totalActive: active.length,
    totalValue: active.reduce((s, d) => s + (Number(d.value) || 0), 0),
    wonCount: won.length, wonValue: won.reduce((s, d) => s + (Number(d.value) || 0), 0),
    byVertical,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [statsResult, tasksResult, remindersResult, pipelineResult, outreachResult, enrollResult, dormantResult, projectsResult] = await Promise.all([
    getStats(), getTasks(), getReminders(), getPipelineStats(),
    supabase.from('sequence_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('next_action_at', tomorrow),
    supabase.from('sequence_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('organizations').select('id, name, vertical, last_activity_at').not('last_activity_at', 'is', null).lt('last_activity_at', sixtyDaysAgo).is('deleted_at', null).order('last_activity_at', { ascending: true }).limit(5),
    supabase.from('projects').select('id, name, status, vertical, project_type, contract_value, percent_complete').is('deleted_at', null).not('status', 'in', '("complete","on_hold","cancelled","closed","done","finished")'),
  ])

  const stats = statsResult; const tasks = tasksResult; const reminders = remindersResult; const pipeline = pipelineResult
  const outreachDueCount = outreachResult.count
  const activeEnrollments = enrollResult.count
  const dormantOrgs = dormantResult.data
  const activeProjectsData = projectsResult.data || []
  const activeProjects = activeProjectsData.length

  // WIP calculations
  const wipTotalValue = activeProjectsData.reduce((s: number, p: any) => s + (Number(p.contract_value) || 0), 0)
  const WIP_COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500']
  const projectVerticalIds = [...new Set(activeProjectsData.map((p: any) => p.vertical).filter(Boolean))] as string[]
  const wipByVertical = projectVerticalIds.map((id: string, i: number) => {
    const vp = activeProjectsData.filter((p: any) => p.vertical === id)
    return {
      id,
      label: id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      color: WIP_COLORS[i % WIP_COLORS.length],
      count: vp.length,
      value: vp.reduce((s: number, p: any) => s + (Number(p.contract_value) || 0), 0),
    }
  }).filter(v => v.count > 0)
  const wipByType = [
    { id: 'major_construction', label: 'Major Construction' },
    { id: 'renovation', label: 'Renovation' },
  ].map(t => {
    const tp = activeProjectsData.filter((p: any) => p.project_type === t.id)
    return { ...t, count: tp.length, value: tp.reduce((s: number, p: any) => s + (Number(p.contract_value) || 0), 0) }
  }).filter(t => t.count > 0)

  const cards = [
    { label: 'Organizations', value: stats.totalOrgs, icon: Building2, href: '/organizations', color: 'bg-blue-50 text-blue-700' },
    { label: 'Contacts', value: stats.totalContacts, icon: Users, href: '/contacts', color: 'bg-green-50 text-green-700' },
    { label: 'Properties', value: stats.totalProperties, icon: MapPin, href: '/properties', color: 'bg-purple-50 text-purple-700' },
    { label: 'Activities', value: stats.totalActivities, icon: Activity, href: '/activities', color: 'bg-orange-50 text-orange-700' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-one70-black">Dashboard</h1>
        <p className="text-one70-mid text-sm mt-1">ONE70 Group CRM Overview</p>
      </div>

      {/* AI BRIEFING */}
      <DashboardBriefing />

      {/* 1. MY TASKS & FOLLOW-UPS */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-one70-black">My Tasks & Follow-ups</h2>
          <Link href="/tasks" className="text-sm font-medium text-one70-black hover:underline">View All →</Link>
        </div>
        <TodoWidget tasks={tasks} reminders={reminders} />
      </div>

      {/* 1.5. OUTREACH QUEUE + PROJECTS + RE-ENGAGEMENT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Link href="/outreach" className="bg-white rounded-lg border border-one70-border p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-one70-mid">Outreach Due</p>
              <p className={`text-3xl font-bold mt-1 ${(outreachDueCount || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>{outreachDueCount || 0}</p>
              <p className="text-xs text-gray-400 mt-1">{activeEnrollments || 0} active enrollments</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 text-amber-700"><Send size={24} /></div>
          </div>
        </Link>
        <Link href="/projects" className="bg-white rounded-lg border border-one70-border p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-one70-mid">Active Projects</p>
              <p className="text-3xl font-bold text-one70-black mt-1">{activeProjects || 0}</p>
              {wipTotalValue > 0 && (
                <p className="text-xs text-one70-mid mt-1">${(wipTotalValue / 1000000).toFixed(1)}M contract value</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-700"><FolderKanban size={24} /></div>
          </div>
        </Link>
        {(dormantOrgs && dormantOrgs.length > 0) ? (
          <div className="bg-white rounded-lg border border-one70-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-sm font-semibold text-red-600">Re-engage ({dormantOrgs.length})</p>
            </div>
            <div className="space-y-1.5">
              {dormantOrgs.map(o => (
                <Link key={o.id} href={`/organizations/${o.id}`} className="flex items-center justify-between text-xs hover:underline">
                  <span className="text-gray-700 truncate">{o.name}</span>
                  <span className="text-gray-400 shrink-0 ml-2">
                    {Math.round((Date.now() - new Date(o.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-one70-border p-5">
            <p className="text-sm text-one70-mid">Re-engagement</p>
            <p className="text-xs text-gray-400 mt-2">No dormant accounts (60+ days)</p>
          </div>
        )}
      </div>

      {/* WORK IN PROGRESS */}
      {activeProjects > 0 && (
        <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-one70-black flex items-center gap-2"><FolderKanban size={20} /> Work in Progress</h2>
            <Link href="/projects" className="text-sm font-medium text-one70-black hover:underline">View All →</Link>
          </div>

          <div className="flex flex-wrap gap-6 mb-4">
            <div>
              <p className="text-xs text-one70-mid uppercase tracking-wider">Active Projects</p>
              <p className="text-2xl font-bold text-one70-black">
                {activeProjects}
                {wipTotalValue > 0 && <span className="text-lg ml-2 text-one70-mid font-medium">${(wipTotalValue >= 1000000 ? (wipTotalValue / 1000000).toFixed(1) + 'M' : (wipTotalValue / 1000).toFixed(0) + 'K')}</span>}
              </p>
            </div>
          </div>

          {/* By Vertical */}
          {wipByVertical.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-4">
              {wipByVertical.map(v => (
                <Link key={v.id} href={`/organizations?vertical=${v.id}`} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <div className={`w-2.5 h-2.5 rounded-full ${v.color}`} />
                  <span className="text-sm font-semibold text-one70-black">{v.count}</span>
                  <span className="text-xs text-one70-mid">{v.label}</span>
                  {v.value > 0 && <span className="text-xs text-one70-mid">(${(v.value >= 1000000 ? (v.value / 1000000).toFixed(1) + 'M' : (v.value / 1000).toFixed(0) + 'K')})</span>}
                </Link>
              ))}
            </div>
          )}

          {/* By Type */}
          {wipByType.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-4">
              {wipByType.map(t => (
                <div key={t.id} className="bg-one70-gray px-3 py-1.5 rounded-md">
                  <span className="text-sm font-semibold text-one70-black">{t.count}</span>
                  <span className="text-xs text-one70-mid ml-1.5">{t.label}</span>
                  {t.value > 0 && <span className="text-xs text-one70-mid ml-1">(${(t.value >= 1000000 ? (t.value / 1000000).toFixed(1) + 'M' : (t.value / 1000).toFixed(0) + 'K')})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Individual project progress bars */}
          <div className="space-y-2 border-t border-one70-border pt-3">
            {activeProjectsData.map((p: any) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 hover:bg-one70-gray rounded-md px-2 py-1.5 -mx-2 transition-colors">
                <span className="text-sm text-one70-dark truncate flex-1">{p.name}</span>
                <div className="w-24 bg-gray-100 rounded-full h-2 shrink-0">
                  <div className={`h-2 rounded-full ${(p.percent_complete || 0) === 100 ? 'bg-green-500' : 'bg-one70-black'}`}
                    style={{ width: `${p.percent_complete || 0}%` }} />
                </div>
                <span className="text-xs text-one70-mid w-8 text-right shrink-0">{p.percent_complete || 0}%</span>
                {p.contract_value && <span className="text-xs text-one70-mid shrink-0">${(Number(p.contract_value) >= 1000000 ? (Number(p.contract_value) / 1000000).toFixed(1) + 'M' : (Number(p.contract_value) / 1000).toFixed(0) + 'K')}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 2. PIPELINE — Total active with QTY by stage */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-one70-black flex items-center gap-2"><Columns3 size={20} /> Pipeline</h2>
          <Link href="/deals" className="text-sm font-medium text-one70-black hover:underline">View All →</Link>
        </div>
        <div className="flex flex-wrap gap-6 mb-4">
          <div>
            <p className="text-xs text-one70-mid uppercase tracking-wider">Active Pipeline</p>
            <p className="text-2xl font-bold text-one70-black">
              {pipeline.totalActive} deal{pipeline.totalActive !== 1 ? 's' : ''}
              {pipeline.totalValue > 0 && <span className="text-lg ml-2 text-one70-mid font-medium">${pipeline.totalValue.toLocaleString()}</span>}
            </p>
          </div>
          {pipeline.wonCount > 0 && (
            <div>
              <p className="text-xs text-one70-mid uppercase tracking-wider">Won</p>
              <p className="text-2xl font-bold text-green-700">
                {pipeline.wonCount}
                {pipeline.wonValue > 0 && <span className="text-lg ml-2 text-green-600 font-medium">${pipeline.wonValue.toLocaleString()}</span>}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-1 items-end h-16">
          {pipeline.stages.map(stage => {
            const maxCount = Math.max(...pipeline.stages.map(s => s.count), 1)
            const height = stage.count > 0 ? Math.max((stage.count / maxCount) * 100, 15) : 8
            return (
              <Link key={stage.id} href={`/deals?stage=${stage.id}`} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <span className="text-[10px] font-semibold text-gray-700">{stage.count || ''}</span>
                <div className={`w-full rounded-t transition-all ${stage.count > 0 ? 'bg-one70-black group-hover:bg-one70-yellow' : 'bg-gray-100'}`} style={{ height: `${height}%` }} />
                <span className="text-[9px] text-gray-500 truncate w-full text-center group-hover:text-one70-black">{stage.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* STALE DEALS ALERT */}
      <StaleDealsWidget />

      {/* UNREPLIED EMAILS ALERT */}
      <UnrepliedEmailsWidget />

      {/* 3. PIPELINE BY VERTICAL */}
      {pipeline.byVertical.some(v => v.activeCount > 0 || v.wonCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {pipeline.byVertical.map(v => {
            const hasDeals = v.activeCount > 0 || v.wonCount > 0
            return (
              <Link key={v.id} href={`/deals?vertical=${v.id}`} className={`bg-white rounded-lg border-l-4 ${v.color} border border-one70-border p-4 hover:shadow-md transition-shadow`}>
                <h3 className="text-sm font-bold text-one70-black mb-2">{v.label}</h3>
                {hasDeals ? (
                  <>
                    <div className="flex items-baseline gap-3 mb-3">
                      <div>
                        <span className="text-xl font-bold text-one70-black">{v.activeCount}</span>
                        <span className="text-xs text-one70-mid ml-1">active</span>
                      </div>
                      {v.activeValue > 0 && (
                        <span className="text-sm text-one70-mid">${v.activeValue.toLocaleString()}</span>
                      )}
                      {v.wonCount > 0 && (
                        <div className="ml-auto text-right">
                          <span className="text-sm font-bold text-green-700">{v.wonCount}</span>
                          <span className="text-xs text-green-600 ml-1">won</span>
                        </div>
                      )}
                    </div>
                    {/* Mini stage indicators */}
                    <div className="flex gap-0.5">
                      {v.stages.map(s => (
                        <div key={s.id} className="flex-1 text-center">
                          <div className={`h-1.5 rounded-full ${s.count > 0 ? v.barColor : 'bg-gray-100'}`} />
                          {s.count > 0 && <span className="text-[9px] text-gray-500 mt-0.5 block">{s.count}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-0.5 mt-0.5">
                      {v.stages.map(s => (
                        <span key={s.id} className="flex-1 text-[7px] text-gray-400 text-center truncate">{s.label}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-2">No active deals</p>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {/* 4. STAT TILES — compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href}
              className="bg-white rounded-lg border border-one70-border px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}><Icon size={18} /></div>
              <div>
                <p className="text-xl font-bold text-one70-black leading-tight">{card.value}</p>
                <p className="text-xs text-one70-mid">{card.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* 5. ORGANIZATIONS BY VERTICAL */}
      <div className="bg-white rounded-lg border border-one70-border px-5 py-4">
        <h2 className="text-sm font-bold text-one70-black mb-3">Organizations by Vertical</h2>
        <div className="flex flex-wrap gap-6">
          {Object.entries(stats.verticalCounts).sort((a, b) => b[1] - a[1]).map(([id, count]) => (
            <Link key={id} href={`/organizations?vertical=${id}`} className="flex items-center gap-2 hover:opacity-80">
              <div className={`w-2 h-2 rounded-full ${getVerticalColor(id).split(' ')[0]}`} />
              <span className="text-lg font-bold text-one70-black">{count}</span>
              <span className="text-xs text-one70-mid">{formatVerticalLabel(id)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
