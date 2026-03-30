import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ACTIVE_STAGE_IDS, STAGE_LABELS, WON_STAGE, LOST_STAGE, isTerminalStage } from '@/lib/stages'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deals }, { data: pipelineConfig }, { data: projects }] = await Promise.all([
    supabase.from('deals').select('id, name, stage, vertical, value, assigned_to, created_at, updated_at, org_id, loss_reason').is('deleted_at', null),
    supabase.from('pipeline_config').select('*').order('sort_order'),
    supabase.from('projects').select('id, org_id, contract_value, status').is('deleted_at', null),
  ])

  const allDeals = deals || []; const config = pipelineConfig || []
  const stageProbMap: Record<string, number> = {}
  config.forEach(c => { stageProbMap[c.stage] = c.probability })

  const active = allDeals.filter(d => !isTerminalStage(d.stage))
  const won = allDeals.filter(d => d.stage === WON_STAGE)
  const lost = allDeals.filter(d => d.stage === LOST_STAGE)
  const closed = [...won, ...lost]
  const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
  const pipeline = active.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const wonValue = won.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const forecast = active.reduce((s, d) => s + (Number(d.value) || 0) * ((stageProbMap[d.stage] || 0) / 100), 0)

  const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toLocaleString()}`
  const stageLabels = STAGE_LABELS
  const { formatVerticalLabel } = await import('@/lib/verticals')
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const stageRows = [...ACTIVE_STAGE_IDS].map(s => {
    const sd = allDeals.filter(d => d.stage === s)
    const raw = sd.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
    return `<tr><td>${stageLabels[s]}</td><td style="text-align:center">${sd.length}</td><td style="text-align:right">${fmt(raw)}</td><td style="text-align:center">${stageProbMap[s] || 0}%</td><td style="text-align:right;font-weight:600">${fmt(Math.round(raw * (stageProbMap[s] || 0) / 100))}</td></tr>`
  }).join('')

  const uniqueVerticals = [...new Set(allDeals.map(d => d.vertical).filter(Boolean))]
  const verticalRows = uniqueVerticals.map(v => {
    const vActive = allDeals.filter(d => d.vertical === v && !isTerminalStage(d.stage))
    const vWon = allDeals.filter(d => d.vertical === v && d.stage === WON_STAGE)
    return `<tr><td>${formatVerticalLabel(v)}</td><td style="text-align:center">${vActive.length}</td><td style="text-align:right">${fmt(vActive.reduce((s, d) => s + (Number(d.value) || 0), 0))}</td><td style="text-align:center">${vWon.length}</td><td style="text-align:right">${fmt(vWon.reduce((s, d) => s + (Number(d.value) || 0), 0))}</td></tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ONE70 Group — Pipeline Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#333;padding:40px;max-width:800px;margin:0 auto}
  h1{font-size:24px;color:#1A1A1A;margin-bottom:4px}h2{font-size:16px;color:#1A1A1A;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #FFE500}
  .subtitle{color:#666;font-size:12px;margin-bottom:24px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}
  .kpi{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center}.kpi-val{font-size:24px;font-weight:700;color:#1A1A1A}.kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th{background:#1A1A1A;color:white;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
  td{padding:8px;border-bottom:1px solid #eee}.footer{margin-top:40px;padding-top:16px;border-top:2px solid #FFE500;text-align:center;color:#999;font-size:11px}
  @media print{body{padding:20px}h1{font-size:20px}}
</style></head><body>
<h1>ONE70 GROUP</h1><p class="subtitle">Pipeline Report — ${date}</p>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${winRate}%</div><div class="kpi-label">Win Rate</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(pipeline)}</div><div class="kpi-label">Pipeline</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#6B21A8">${fmt(Math.round(forecast))}</div><div class="kpi-label">Forecast</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#16A34A">${fmt(wonValue)}</div><div class="kpi-label">Revenue Won</div></div>
</div>
<p style="font-size:12px;color:#666">${active.length} active deals · ${won.length} won · ${lost.length} lost · ${(projects || []).filter(p => !['complete','on_hold','cancelled','closed','done','finished'].includes(p.status)).length} active projects</p>
<h2>Weighted Pipeline Forecast</h2>
<table><thead><tr><th>Stage</th><th style="text-align:center">Deals</th><th style="text-align:right">Raw Value</th><th style="text-align:center">Probability</th><th style="text-align:right">Weighted</th></tr></thead><tbody>${stageRows}
<tr style="font-weight:700;border-top:2px solid #1A1A1A"><td>Total</td><td style="text-align:center">${active.length}</td><td style="text-align:right">${fmt(pipeline)}</td><td></td><td style="text-align:right;color:#6B21A8">${fmt(Math.round(forecast))}</td></tr></tbody></table>
<h2>Performance by Vertical</h2>
<table><thead><tr><th>Vertical</th><th style="text-align:center">Active Deals</th><th style="text-align:right">Pipeline</th><th style="text-align:center">Won</th><th style="text-align:right">Won Revenue</th></tr></thead><tbody>${verticalRows}</tbody></table>
<div class="footer"><p>ONE70 Group · Clear Cost. Clear Schedule. Ability to Scale. · one70group.com</p></div>
<script>window.print()</script></body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
