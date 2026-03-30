'use client'

import { TrendingUp, Target, DollarSign, Clock, Zap } from 'lucide-react'
import Link from 'next/link'

interface Props {
  winRate: number; totalPipelineValue: number; wonValue: number; avgDealSize: number; avgVelocity: number
  activeDealsCount: number; wonDealsCount: number; lostDealsCount: number; newContactsCount: number; totalActivities: number
  dealsByStage: { stage: string; count: number; value: number }[]
  dealsByVertical: { vertical: string; active: number; won: number; lost: number; value: number }[]
  activityByType: Record<string, number>; weeklyActivity: { week: string; count: number }[]
  repPerformance: { name: string; activities: number; calls: number; emails: number; meetings: number; activeDeals: number; pipelineValue: number; won: number; wonValue: number }[]
  weightedForecast: number; forecastByStage: { stage: string; raw: number; weighted: number; probability: number; count: number }[]
  velocityByVertical: { vertical: string; avgDays: number; dealCount: number }[]
  channelROI: { channel: string; activities: number; dealsInfluenced: number; pipelineValue: number; wonDeals: number; wonValue: number }[]
  portfolioCapture: { orgName: string; vertical: string; totalProperties: number; propertiesWorked: number; capturedRevenue: number; captureRate: number }[]
  revenueByQuarter: { quarter: string; value: number; count: number }[]
  lossReasons: Record<string, number>; emailStats: { sent: number; opened: number; clicked: number; bounced: number }
  territoryPerformance: { name: string; color: string; repName: string; orgs: number; activeDeals: number; pipeline: number; wonDeals: number; wonValue: number; pipelineTarget: number; revenueTarget: number }[]
}

function fmt(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const actLabels: Record<string, string> = { call: 'Calls', email: 'Emails', meeting: 'Meetings', note: 'Notes', linkedin: 'LinkedIn', text: 'Texts', site_visit: 'Site Visits', other: 'Other' }
const actColors: Record<string, string> = { call: 'bg-green-500', email: 'bg-blue-500', meeting: 'bg-purple-500', note: 'bg-gray-400', linkedin: 'bg-indigo-500', text: 'bg-pink-500', site_visit: 'bg-amber-500', other: 'bg-gray-300' }

export default function AnalyticsCharts(p: Props) {
  const maxWeekly = Math.max(...p.weeklyActivity.map(w => w.count), 1)
  const maxStage = Math.max(...p.dealsByStage.map(s => s.count), 1)
  const totalAct = Object.values(p.activityByType).reduce((s, v) => s + v, 0) || 1
  const maxQRevenue = Math.max(...p.revenueByQuarter.map(q => q.value), 1)
  const maxForecast = Math.max(...p.forecastByStage.map(f => f.raw), 1)

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Win Rate', value: `${p.winRate}%`, color: p.winRate >= 30 ? 'text-green-600' : 'text-amber-600', icon: Target },
          { label: 'Pipeline', value: fmt(p.totalPipelineValue), color: 'text-blue-600', icon: DollarSign },
          { label: 'Forecast', value: fmt(p.weightedForecast), color: 'text-purple-600', icon: TrendingUp },
          { label: 'Revenue Won', value: fmt(p.wonValue), color: 'text-green-600', icon: DollarSign },
          { label: 'Avg Deal', value: fmt(p.avgDealSize), color: 'text-gray-700', icon: DollarSign },
          { label: 'Avg Days', value: p.avgVelocity > 0 ? `${p.avgVelocity}d` : '—', color: 'text-orange-600', icon: Clock },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg border border-one70-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <k.icon size={14} className={k.color} />
              <span className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider">{k.label}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-one70-border p-4 text-center"><p className="text-3xl font-bold">{p.activeDealsCount}</p><p className="text-xs text-one70-mid">Active Deals</p></div>
        <div className="bg-white rounded-lg border border-one70-border p-4 text-center"><p className="text-3xl font-bold text-green-600">{p.wonDealsCount}</p><p className="text-xs text-one70-mid">Won</p></div>
        <div className="bg-white rounded-lg border border-one70-border p-4 text-center"><p className="text-3xl font-bold text-red-500">{p.lostDealsCount}</p><p className="text-xs text-one70-mid">Lost</p></div>
        <div className="bg-white rounded-lg border border-one70-border p-4 text-center"><p className="text-3xl font-bold">{p.newContactsCount}</p><p className="text-xs text-one70-mid">New Contacts (90d)</p></div>
      </div>

      {/* === NEW: WEIGHTED FORECAST === */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-dark mb-4">Weighted Pipeline Forecast</h2>
        <div className="space-y-3">
          {p.forecastByStage.filter(f => f.count > 0).map(f => (
            <div key={f.stage}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{f.stage} <span className="text-gray-400">({f.probability}%)</span></span>
                <span className="text-xs text-gray-500">{f.count} deals · {fmt(f.raw)} → <span className="font-semibold text-purple-700">{fmt(f.weighted)}</span></span>
              </div>
              <div className="h-3 bg-one70-gray rounded-full overflow-hidden flex">
                <div className="h-full bg-gray-200 rounded-full" style={{ width: `${(f.raw / maxForecast) * 100}%` }} />
                <div className="h-full bg-purple-500 rounded-full -ml-[1px]" style={{ width: `${(f.weighted / maxForecast) * 100}%`, marginLeft: `-${(f.weighted / maxForecast) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-one70-border flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Weighted forecast total</span>
          <span className="text-lg font-bold text-purple-700">{fmt(p.weightedForecast)}</span>
        </div>
      </div>

      {/* === NEW: REVENUE BY QUARTER === */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-dark mb-4">Revenue by Quarter</h2>
        <div className="flex items-end gap-2 h-32">
          {p.revenueByQuarter.map((q, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {q.value > 0 && <span className="text-[9px] text-gray-500 font-medium">{fmt(q.value)}</span>}
              <div className={`w-full rounded-t transition-all ${q.value > 0 ? 'bg-green-500' : 'bg-gray-100'}`}
                style={{ height: `${q.value > 0 ? Math.max((q.value / maxQRevenue) * 100, 8) : 4}%` }} />
              <span className="text-[8px] text-gray-400 text-center">{q.quarter}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals by stage */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Deals by Stage</h2>
          <div className="space-y-3">
            {p.dealsByStage.map(s => (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{s.stage}</span>
                  <span className="text-xs text-gray-500">{s.count}{s.value > 0 ? ` · ${fmt(s.value)}` : ''}</span>
                </div>
                <div className="h-3 bg-one70-gray rounded-full overflow-hidden">
                  <div className="h-full bg-one70-black rounded-full" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deals by vertical */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Deals by Vertical</h2>
          <div className="space-y-4">
            {p.dealsByVertical.map(v => (
              <div key={v.vertical} className="border-b border-one70-border pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{v.vertical}</span>
                  {v.value > 0 && <span className="text-xs font-semibold text-gray-600">{fmt(v.value)}</span>}
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-blue-600">{v.active} active</span>
                  <span className="text-green-600">{v.won} won</span>
                  <span className="text-red-500">{v.lost} lost</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === NEW: VELOCITY BY VERTICAL === */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Deal Velocity by Vertical</h2>
          <div className="space-y-4">
            {p.velocityByVertical.map(v => (
              <div key={v.vertical} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{v.vertical}</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-orange-600">{v.avgDays > 0 ? `${v.avgDays}d` : '—'}</span>
                  <span className="text-xs text-gray-400 ml-2">({v.dealCount} deals)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === NEW: LOSS REASONS === */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Loss Reasons</h2>
          {Object.keys(p.lossReasons).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(p.lossReasons).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700">{reason}</span>
                  <span className="text-xs font-semibold text-red-600">{count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">No lost deals yet</p>}
        </div>

        {/* Activity trend */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Activity Trend (12 Weeks)</h2>
          <div className="flex items-end gap-1 h-32">
            {p.weeklyActivity.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500 font-medium">{w.count || ''}</span>
                <div className={`w-full rounded-t ${w.count > 0 ? 'bg-one70-black' : 'bg-gray-100'}`}
                  style={{ height: `${w.count > 0 ? Math.max((w.count / maxWeekly) * 100, 8) : 4}%` }} />
                <span className="text-[8px] text-gray-400 -rotate-45 origin-top-left w-8 truncate">{w.week}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-one70-mid mt-4 text-center">{p.totalActivities} total activities in the last 90 days</p>
        </div>

        {/* Activity breakdown */}
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Activity Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(p.activityByType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 capitalize">{actLabels[type] || type}</span>
                  <span className="text-xs text-gray-500">{count} ({Math.round((count / totalAct) * 100)}%)</span>
                </div>
                <div className="h-2 bg-one70-gray rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${actColors[type] || 'bg-gray-400'}`} style={{ width: `${(count / totalAct) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === NEW: CHANNEL ROI === */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-dark mb-4">Outreach Channel ROI</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-one70-mid uppercase tracking-wider border-b border-one70-border">
                <th className="text-left pb-2 font-semibold">Channel</th>
                <th className="text-center pb-2 font-semibold">Activities</th>
                <th className="text-center pb-2 font-semibold">Deals Influenced</th>
                <th className="text-center pb-2 font-semibold">Pipeline</th>
                <th className="text-center pb-2 font-semibold">Won Deals</th>
                <th className="text-center pb-2 font-semibold">Won Revenue</th>
              </tr>
            </thead>
            <tbody>
              {p.channelROI.filter(c => c.activities > 0).map(c => (
                <tr key={c.channel} className="border-b border-one70-border last:border-0">
                  <td className="py-2.5 text-sm font-medium text-gray-900 capitalize">{actLabels[c.channel] || c.channel}</td>
                  <td className="py-2.5 text-sm text-center text-gray-700">{c.activities}</td>
                  <td className="py-2.5 text-sm text-center text-gray-700">{c.dealsInfluenced}</td>
                  <td className="py-2.5 text-sm text-center text-gray-700">{c.pipelineValue > 0 ? fmt(c.pipelineValue) : '—'}</td>
                  <td className="py-2.5 text-sm text-center text-gray-700">{c.wonDeals || '—'}</td>
                  <td className="py-2.5 text-sm text-center font-semibold text-green-600">{c.wonValue > 0 ? fmt(c.wonValue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* === NEW: PORTFOLIO CAPTURE === */}
      {p.portfolioCapture.length > 0 && (
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Portfolio Capture Rate</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-one70-mid uppercase tracking-wider border-b border-one70-border">
                  <th className="text-left pb-2 font-semibold">Organization</th>
                  <th className="text-center pb-2 font-semibold">Vertical</th>
                  <th className="text-center pb-2 font-semibold">Portfolio Size</th>
                  <th className="text-center pb-2 font-semibold">Properties Worked</th>
                  <th className="text-center pb-2 font-semibold">Captured Revenue</th>
                  <th className="text-center pb-2 font-semibold">Capture %</th>
                </tr>
              </thead>
              <tbody>
                {p.portfolioCapture.slice(0, 15).map(c => (
                  <tr key={c.orgName} className="border-b border-one70-border last:border-0">
                    <td className="py-2.5 text-sm font-medium text-gray-900">{c.orgName}</td>
                    <td className="py-2.5 text-xs text-center text-gray-500">{c.vertical}</td>
                    <td className="py-2.5 text-sm text-center">{c.totalProperties || '—'}</td>
                    <td className="py-2.5 text-sm text-center">{c.propertiesWorked}</td>
                    <td className="py-2.5 text-sm text-center font-semibold text-green-600">{fmt(c.capturedRevenue)}</td>
                    <td className="py-2.5 text-center">
                      {c.captureRate > 0 ? (
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-2 bg-one70-gray rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(c.captureRate, 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{c.captureRate}%</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === NEW: EMAIL STATS === */}
      {p.emailStats.sent > 0 && (
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Email Outreach (90 Days)</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center"><p className="text-2xl font-bold text-blue-600">{p.emailStats.sent}</p><p className="text-xs text-gray-500">Sent</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-green-600">{p.emailStats.opened}</p><p className="text-xs text-gray-500">Opened</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-purple-600">{p.emailStats.clicked}</p><p className="text-xs text-gray-500">Clicked</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-red-500">{p.emailStats.bounced}</p><p className="text-xs text-gray-500">Bounced</p></div>
          </div>
          {p.emailStats.sent > 0 && (
            <div className="mt-3 pt-3 border-t border-one70-border flex gap-6 justify-center text-xs text-gray-500">
              <span>Open rate: <strong>{Math.round((p.emailStats.opened / p.emailStats.sent) * 100)}%</strong></span>
              <span>Click rate: <strong>{p.emailStats.opened > 0 ? Math.round((p.emailStats.clicked / p.emailStats.opened) * 100) : 0}%</strong></span>
              <span>Bounce rate: <strong>{Math.round((p.emailStats.bounced / p.emailStats.sent) * 100)}%</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Rep Performance */}
      {p.repPerformance.length > 0 && (
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Rep Performance (Last 90 Days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-xs text-one70-mid uppercase tracking-wider border-b border-one70-border">
                  <th className="text-left pb-2 font-semibold">Rep</th>
                  <th className="text-center pb-2 font-semibold">Activities</th>
                  <th className="text-center pb-2 font-semibold">Calls</th>
                  <th className="text-center pb-2 font-semibold">Emails</th>
                  <th className="text-center pb-2 font-semibold">Meetings</th>
                  <th className="text-center pb-2 font-semibold">Active Deals</th>
                  <th className="text-center pb-2 font-semibold">Pipeline</th>
                  <th className="text-center pb-2 font-semibold">Won</th>
                </tr>
              </thead>
              <tbody>
                {p.repPerformance.map(rep => (
                  <tr key={rep.name} className="border-b border-one70-border last:border-0">
                    <td className="py-2.5 text-sm font-medium text-gray-900">{rep.name}</td>
                    <td className="py-2.5 text-sm text-center">{rep.activities}</td>
                    <td className="py-2.5 text-sm text-center">{rep.calls}</td>
                    <td className="py-2.5 text-sm text-center">{rep.emails}</td>
                    <td className="py-2.5 text-sm text-center">{rep.meetings}</td>
                    <td className="py-2.5 text-sm text-center">{rep.activeDeals}</td>
                    <td className="py-2.5 text-sm text-center">{rep.pipelineValue > 0 ? fmt(rep.pipelineValue) : '—'}</td>
                    <td className="py-2.5 text-sm text-center font-semibold text-green-600">{rep.won > 0 ? `${rep.won} (${fmt(rep.wonValue)})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === TERRITORY PERFORMANCE === */}
      {p.territoryPerformance.length > 0 && (
        <div className="bg-white rounded-lg border border-one70-border p-5">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">Territory Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-xs text-one70-mid uppercase tracking-wider border-b border-one70-border">
                  <th className="text-left pb-2 font-semibold">Territory</th>
                  <th className="text-left pb-2 font-semibold">Rep</th>
                  <th className="text-center pb-2 font-semibold">Orgs</th>
                  <th className="text-center pb-2 font-semibold">Active Deals</th>
                  <th className="text-center pb-2 font-semibold">Pipeline</th>
                  <th className="text-center pb-2 font-semibold">Pipeline vs Target</th>
                  <th className="text-center pb-2 font-semibold">Won</th>
                  <th className="text-center pb-2 font-semibold">Revenue vs Target</th>
                </tr>
              </thead>
              <tbody>
                {p.territoryPerformance.map(t => {
                  const pPct = t.pipelineTarget > 0 ? Math.min(Math.round((t.pipeline / t.pipelineTarget) * 100), 150) : 0
                  const rPct = t.revenueTarget > 0 ? Math.min(Math.round((t.wonValue / t.revenueTarget) * 100), 150) : 0
                  return (
                    <tr key={t.name} className="border-b border-one70-border last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-sm font-medium text-gray-900">{t.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-sm text-gray-600">{t.repName || '—'}</td>
                      <td className="py-2.5 text-sm text-center">{t.orgs}</td>
                      <td className="py-2.5 text-sm text-center">{t.activeDeals}</td>
                      <td className="py-2.5 text-sm text-center font-medium text-blue-600">{t.pipeline > 0 ? fmt(t.pipeline) : '—'}</td>
                      <td className="py-2.5">
                        {t.pipelineTarget > 0 ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 bg-one70-gray rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pPct, 100)}%`, backgroundColor: t.color }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: pPct >= 80 ? '#16A34A' : pPct >= 50 ? '#D97706' : '#DC2626' }}>{pPct}%</span>
                          </div>
                        ) : <span className="text-xs text-gray-400 text-center block">No target</span>}
                      </td>
                      <td className="py-2.5 text-sm text-center font-semibold text-green-600">{t.wonDeals > 0 ? `${t.wonDeals} (${fmt(t.wonValue)})` : '—'}</td>
                      <td className="py-2.5">
                        {t.revenueTarget > 0 ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 bg-one70-gray rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(rPct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: rPct >= 80 ? '#16A34A' : rPct >= 50 ? '#D97706' : '#DC2626' }}>{rPct}%</span>
                          </div>
                        ) : <span className="text-xs text-gray-400 text-center block">No target</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
