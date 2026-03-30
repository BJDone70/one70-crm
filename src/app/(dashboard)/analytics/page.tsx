import { createClient } from '@/lib/supabase/server'
import AnalyticsCharts from './analytics-charts'
import { ACTIVE_STAGE_IDS, STAGE_LABELS, WON_STAGE, LOST_STAGE, isTerminalStage } from '@/lib/stages'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: deals }, { data: activities }, { data: reps }, { data: recentContacts },
    { data: orgs }, { data: projects }, { data: pipelineConfig }, { data: emailSends },
    { data: territories },
  ] = await Promise.all([
    supabase.from('deals').select('id, name, stage, vertical, value, assigned_to, created_at, updated_at, org_id, loss_reason, territory_id').is('deleted_at', null),
    supabase.from('activities').select('id, type, user_id, occurred_at, contact_id, org_id, deal_id, source_channel').gte('occurred_at', ninetyDaysAgo).order('occurred_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    supabase.from('contacts').select('id, created_at').gte('created_at', ninetyDaysAgo).is('deleted_at', null),
    supabase.from('organizations').select('id, name, vertical, portfolio_size, territory_id').is('deleted_at', null),
    supabase.from('projects').select('id, org_id, contract_value, status, vertical, territory_id').is('deleted_at', null),
    supabase.from('pipeline_config').select('*').order('sort_order'),
    supabase.from('email_sends').select('id, status, created_at').gte('created_at', ninetyDaysAgo),
    supabase.from('territories').select('id, name, color, assigned_to, pipeline_target, revenue_target').eq('is_active', true).order('sort_order'),
  ])

  const allDeals = deals || []; const allActivities = activities || []; const allReps = reps || []
  const allOrgs = orgs || []; const allProjects = projects || []; const config = pipelineConfig || []

  const stageProbMap: Record<string, number> = {}
  config.forEach(c => { stageProbMap[c.stage] = c.probability })

  const activeDeals = allDeals.filter(d => !isTerminalStage(d.stage))
  const wonDeals = allDeals.filter(d => d.stage === WON_STAGE)
  const lostDeals = allDeals.filter(d => d.stage === LOST_STAGE)
  const closedDeals = [...wonDeals, ...lostDeals]
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0
  const totalPipelineValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const wonValue = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const avgDealSize = wonDeals.length > 0 ? Math.round(wonValue / wonDeals.length) : 0

  const wonWithDates = wonDeals.filter(d => d.created_at && d.updated_at)
  const avgVelocity = wonWithDates.length > 0
    ? Math.round(wonWithDates.reduce((s, d) => s + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24), 0) / wonWithDates.length) : 0

  const stageOrder = [...ACTIVE_STAGE_IDS]
  const stageLabels = STAGE_LABELS
  const dealsByStage = stageOrder.map(id => ({ stage: stageLabels[id], count: allDeals.filter(d => d.stage === id).length, value: allDeals.filter(d => d.stage === id).reduce((s, d) => s + (Number(d.value) || 0), 0) }))

  const { formatVerticalLabel } = await import('@/lib/verticals')
  const uniqueVerticals = [...new Set(allDeals.map(d => d.vertical).filter(Boolean))]
  const dealsByVertical = uniqueVerticals.map(v => ({
    vertical: formatVerticalLabel(v),
    active: allDeals.filter(d => d.vertical === v && !isTerminalStage(d.stage)).length,
    won: allDeals.filter(d => d.vertical === v && d.stage === WON_STAGE).length,
    lost: allDeals.filter(d => d.vertical === v && d.stage === LOST_STAGE).length,
    value: allDeals.filter(d => d.vertical === v && !isTerminalStage(d.stage)).reduce((s, d) => s + (Number(d.value) || 0), 0),
  }))

  const activityByType: Record<string, number> = {}
  allActivities.forEach(a => { activityByType[a.type] = (activityByType[a.type] || 0) + 1 })

  const weeklyActivity: { week: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(Date.now() - (i + 1) * 7 * 86400000); const we = new Date(Date.now() - i * 7 * 86400000)
    weeklyActivity.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: allActivities.filter(a => { const d = new Date(a.occurred_at); return d >= ws && d < we }).length })
  }

  const repPerformance = allReps.filter(r => r.role !== 'viewer').map(rep => {
    const ra = allActivities.filter(a => a.user_id === rep.id); const rd = allDeals.filter(d => d.assigned_to === rep.id)
    const rw = rd.filter(d => d.stage === WON_STAGE); const rA = rd.filter(d => !isTerminalStage(d.stage))
    return { name: rep.full_name, activities: ra.length, calls: ra.filter(a => a.type === 'call').length, emails: ra.filter(a => a.type === 'email').length, meetings: ra.filter(a => a.type === 'meeting').length, activeDeals: rA.length, pipelineValue: rA.reduce((s, d) => s + (Number(d.value) || 0), 0), won: rw.length, wonValue: rw.reduce((s, d) => s + (Number(d.value) || 0), 0) }
  })

  // WEIGHTED FORECAST
  const weightedForecast = activeDeals.reduce((s, d) => s + (Number(d.value) || 0) * ((stageProbMap[d.stage] || 0) / 100), 0)
  const forecastByStage = stageOrder.map(id => {
    const sd = allDeals.filter(d => d.stage === id); const raw = sd.reduce((s, d) => s + (Number(d.value) || 0), 0)
    return { stage: stageLabels[id], raw, weighted: Math.round(raw * (stageProbMap[id] || 0) / 100), probability: stageProbMap[id] || 0, count: sd.length }
  })

  // VELOCITY BY VERTICAL
  const velocityVerticals = [...new Set(wonWithDates.map(d => d.vertical).filter(Boolean))]
  const velocityByVertical = velocityVerticals.map(v => {
    const vW = wonWithDates.filter(d => d.vertical === v)
    return { vertical: formatVerticalLabel(v), avgDays: vW.length > 0 ? Math.round(vW.reduce((s, d) => s + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000, 0) / vW.length) : 0, dealCount: vW.length }
  })

  // CHANNEL ROI
  const channelROI = ['call', 'email', 'meeting', 'linkedin', 'text', 'site_visit'].map(ch => {
    const ca = allActivities.filter(a => a.type === ch); const dids = new Set(ca.filter(a => a.deal_id).map(a => a.deal_id))
    const td = allDeals.filter(d => dids.has(d.id)); const cw = td.filter(d => d.stage === 'awarded'); const cp = td.filter(d => !['awarded', 'lost'].includes(d.stage))
    return { channel: ch, activities: ca.length, dealsInfluenced: td.length, pipelineValue: cp.reduce((s, d) => s + (Number(d.value) || 0), 0), wonDeals: cw.length, wonValue: cw.reduce((s, d) => s + (Number(d.value) || 0), 0) }
  }).sort((a, b) => b.wonValue - a.wonValue)

  // PORTFOLIO CAPTURE
  const portfolioCapture = allOrgs.filter(o => wonDeals.some(d => d.org_id === o.id) || allProjects.some(p => p.org_id === o.id)).map(o => {
    const ow = wonDeals.filter(d => d.org_id === o.id); const op = allProjects.filter(p => p.org_id === o.id)
    const captured = ow.reduce((s, d) => s + (Number(d.value) || 0), 0) + op.reduce((s, p) => s + (Number(p.contract_value) || 0), 0)
    const worked = new Set([...ow.map(d => d.id), ...op.map(p => p.id)]).size
    return { orgName: o.name, vertical: formatVerticalLabel(o.vertical), totalProperties: o.portfolio_size || 0, propertiesWorked: worked, capturedRevenue: captured, captureRate: (o.portfolio_size || 0) > 0 ? Math.round((worked / o.portfolio_size!) * 100) : 0 }
  }).sort((a, b) => b.capturedRevenue - a.capturedRevenue)

  // REVENUE BY QUARTER
  const revenueByQuarter: { quarter: string; value: number; count: number }[] = []
  const now = new Date()
  for (let q = 7; q >= 0; q--) {
    const qS = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - q * 3, 1)
    const qE = new Date(qS.getFullYear(), qS.getMonth() + 3, 0)
    const qD = wonDeals.filter(d => { const c = new Date(d.updated_at); return c >= qS && c <= qE })
    revenueByQuarter.push({ quarter: `Q${Math.floor(qS.getMonth() / 3) + 1} ${qS.getFullYear()}`, value: qD.reduce((s, d) => s + (Number(d.value) || 0), 0), count: qD.length })
  }

  // LOSS REASONS
  const lossReasons: Record<string, number> = {}
  lostDeals.forEach(d => { lossReasons[d.loss_reason || 'Not specified'] = (lossReasons[d.loss_reason || 'Not specified'] || 0) + 1 })

  // EMAIL STATS
  const emailStats = { sent: (emailSends || []).length, opened: (emailSends || []).filter(e => e.status === 'opened').length, clicked: (emailSends || []).filter(e => e.status === 'clicked').length, bounced: (emailSends || []).filter(e => e.status === 'bounced').length }

  // TERRITORY PERFORMANCE
  const allTerritories = territories || []
  const repNameMap = Object.fromEntries(allReps.map(r => [r.id, r.full_name]))
  const territoryPerformance = allTerritories.map(t => {
    const tDeals = allDeals.filter(d => d.territory_id === t.id)
    const tActive = tDeals.filter(d => !['awarded', 'lost'].includes(d.stage))
    const tWon = tDeals.filter(d => d.stage === 'awarded')
    const tOrgs = allOrgs.filter(o => o.territory_id === t.id)
    const pipelineVal = tActive.reduce((s, d) => s + (Number(d.value) || 0), 0)
    const wonVal = tWon.reduce((s, d) => s + (Number(d.value) || 0), 0)
    return {
      name: t.name, color: t.color, repName: t.assigned_to ? repNameMap[t.assigned_to] || '' : '',
      orgs: tOrgs.length, activeDeals: tActive.length, pipeline: pipelineVal,
      wonDeals: tWon.length, wonValue: wonVal,
      pipelineTarget: Number(t.pipeline_target) || 0, revenueTarget: Number(t.revenue_target) || 0,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Analytics</h1>
          <p className="text-one70-mid text-sm mt-1">Pipeline performance, forecasting, and revenue intelligence</p>
        </div>
        <a href="/api/analytics/export" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 border border-one70-border px-4 py-2 rounded-md text-sm font-medium text-one70-dark hover:bg-one70-gray transition-colors">
          Export PDF
        </a>
      </div>
      <AnalyticsCharts
        winRate={winRate} totalPipelineValue={totalPipelineValue} wonValue={wonValue}
        avgDealSize={avgDealSize} avgVelocity={avgVelocity}
        activeDealsCount={activeDeals.length} wonDealsCount={wonDeals.length} lostDealsCount={lostDeals.length}
        newContactsCount={recentContacts?.length || 0} totalActivities={allActivities.length}
        dealsByStage={dealsByStage} dealsByVertical={dealsByVertical}
        activityByType={activityByType} weeklyActivity={weeklyActivity} repPerformance={repPerformance}
        weightedForecast={weightedForecast} forecastByStage={forecastByStage}
        velocityByVertical={velocityByVertical} channelROI={channelROI}
        portfolioCapture={portfolioCapture} revenueByQuarter={revenueByQuarter}
        lossReasons={lossReasons} emailStats={emailStats}
        territoryPerformance={territoryPerformance}
      />
    </div>
  )
}
