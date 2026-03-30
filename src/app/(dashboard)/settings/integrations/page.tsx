'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Calendar, Database, Zap, Check, X, Loader2, Play, Pause, Trash2 } from 'lucide-react'
import WritingStyleProfile from '@/components/writing-style-profile'

interface Integration { id: string; provider: string; email_address: string; is_active: boolean; created_at: string }
interface Workflow { id: string; name: string; trigger_type: string; is_active: boolean; workflow_actions: any[] }

const triggerLabels: Record<string, string> = {
  deal_won: 'Deal Won', deal_lost: 'Deal Lost', deal_stage_change: 'Stage Change', new_contact: 'New Contact', inactivity: 'Inactivity',
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [apolloKey, setApolloKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: ints } = await supabase.from('integrations').select('*').order('created_at')
      setIntegrations(ints || [])
      const existing = ints?.find(i => i.provider === 'apollo')
      if (existing?.api_key) setApolloKey(existing.api_key)

      const { data: wfs } = await supabase.from('workflows').select('*, workflow_actions(*)').is('deleted_at', null).order('created_at')
      setWorkflows(wfs || [])
      setLoading(false)
    }
    load()
  }, [])

  const googleConnected = integrations.find(i => i.provider === 'google' && i.is_active)
  const msConnected = integrations.find(i => i.provider === 'microsoft' && i.is_active)
  const apolloConnected = integrations.find(i => i.provider === 'apollo' && i.is_active)

  async function connectGoogle() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) { setResult('Google Client ID not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to environment variables.'); return }
    const redirect = `${window.location.origin}/api/integrations/google/callback`
    const scopes = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly'
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`
  }

  const [m365Status, setM365Status] = useState<any>(null)

  useEffect(() => {
    // Check M365 connection status
    supabase.from('m365_tokens').select('connected_email, connected_at, last_sync_at, sync_status, sync_error')
      .limit(1).single().then(({ data }) => setM365Status(data))

    // Check URL params for M365 callback result
    const params = new URLSearchParams(window.location.search)
    if (params.get('m365') === 'connected') {
      setResult(`Microsoft 365 connected successfully (${params.get('email') || ''})`)
      supabase.from('m365_tokens').select('connected_email, connected_at, last_sync_at, sync_status').limit(1).single().then(({ data }) => setM365Status(data))
    } else if (params.get('m365') === 'error') {
      setResult(`Microsoft 365 connection failed: ${decodeURIComponent(params.get('msg') || 'Unknown error')}`)
    }
    // Clean URL params to prevent stale state on refresh
    if (params.get('m365')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function connectMicrosoft() {
    // Use our dedicated M365 OAuth flow
    window.location.href = '/api/m365/connect'
  }

  async function disconnectM365() {
    if (!confirm('Disconnect Microsoft 365? Email and calendar sync will stop.')) return
    await supabase.from('m365_tokens').delete().neq('id', '')
    setM365Status(null)
    setResult('Microsoft 365 disconnected')
  }

  async function triggerSync() {
    setResult('Syncing...')
    const res = await fetch('/api/cron/m365-sync')
    const data = await res.json()
    setResult(`Sync complete: ${JSON.stringify(data.synced?.[0] || data)}`)
    supabase.from('m365_tokens').select('connected_email, connected_at, last_sync_at, sync_status').limit(1).single().then(({ data }) => setM365Status(data))
  }

  async function saveApolloKey() {
    setSaving(true)
    setResult('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (apolloConnected) {
      await supabase.from('integrations').update({ api_key: apolloKey, is_active: !!apolloKey, updated_at: new Date().toISOString() }).eq('id', apolloConnected.id)
    } else {
      await supabase.from('integrations').insert({ user_id: user.id, provider: 'apollo', api_key: apolloKey, is_active: true })
    }

    setResult('Apollo.io key saved')
    setSaving(false)
    const { data: ints } = await supabase.from('integrations').select('*').order('created_at')
    setIntegrations(ints || [])
    setTimeout(() => setResult(''), 2000)
  }

  async function disconnect(id: string) {
    await supabase.from('integrations').update({ is_active: false, access_token: null, refresh_token: null }).eq('id', id)
    const { data: ints } = await supabase.from('integrations').select('*').order('created_at')
    setIntegrations(ints || [])
  }

  async function toggleWorkflow(id: string, active: boolean) {
    await supabase.from('workflows').update({ is_active: active }).eq('id', id)
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w))
  }

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading...</div>

  return (
    <div>
      <Link href="/settings/users" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-1">Integrations & Automation</h1>
      <p className="text-one70-mid text-sm mb-6">Connect external services and manage automated workflows</p>

      {result && <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm mb-4">{result}</div>}

      {/* Email Integration */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
        <h2 className="text-sm font-semibold text-one70-dark mb-4 flex items-center gap-2"><Mail size={16} /> Email Sync</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-one70-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Google (Gmail)</h3>
              {googleConnected ? <span className="flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Connected</span> : null}
            </div>
            <p className="text-xs text-gray-500 mb-3">Auto-log emails sent to contacts in your CRM</p>
            {googleConnected ? (
              <div>
                <p className="text-xs text-gray-400 mb-2">{googleConnected.email_address}</p>
                <button onClick={() => disconnect(googleConnected.id)} className="text-xs text-red-600 hover:text-red-800">Disconnect</button>
              </div>
            ) : (
              <button onClick={connectGoogle} className="bg-one70-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors">Connect Gmail</button>
            )}
          </div>
          <div className="border border-one70-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Microsoft 365</h3>
              {(msConnected || m365Status) ? <span className="flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Connected</span> : null}
            </div>
            <p className="text-xs text-gray-500 mb-3">Auto-sync emails and calendar from Outlook. Matches interactions with CRM contacts and logs activities automatically.</p>
            {m365Status ? (
              <div>
                <p className="text-xs text-one70-dark mb-1">{m365Status.connected_email}</p>
                <p className="text-xs text-gray-400 mb-1">Connected {new Date(m365Status.connected_at).toLocaleDateString()}</p>
                {m365Status.last_sync_at && (
                  <p className="text-xs text-gray-400 mb-1">Last sync: {new Date(m365Status.last_sync_at).toLocaleString()}</p>
                )}
                {m365Status.sync_status === 'error' && m365Status.sync_error && (
                  <p className="text-xs text-red-600 mb-2">Error: {m365Status.sync_error}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={triggerSync} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium transition-colors">Sync Now</button>
                  <button onClick={disconnectM365} className="text-xs text-red-600 hover:text-red-800">Disconnect</button>
                </div>
              </div>
            ) : msConnected ? (
              <div>
                <p className="text-xs text-gray-400 mb-2">{msConnected.email_address} (legacy connection)</p>
                <button onClick={connectMicrosoft} className="bg-one70-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors">Upgrade Connection</button>
              </div>
            ) : (
              <button onClick={connectMicrosoft} className="bg-one70-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors">Connect Microsoft 365</button>
            )}
          </div>
        </div>
      </div>

      {/* Apollo Integration */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
        <h2 className="text-sm font-semibold text-one70-dark mb-4 flex items-center gap-2"><Database size={16} /> Apollo.io</h2>
        <p className="text-xs text-gray-500 mb-3">Sync prospects and enrich contacts directly from Apollo.io</p>
        <div className="flex gap-2">
          <input type="password" value={apolloKey} onChange={e => setApolloKey(e.target.value)} placeholder="Apollo.io API key"
            className="flex-1 px-3 py-2 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow" />
          <button onClick={saveApolloKey} disabled={saving}
            className="bg-one70-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-one70-dark disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : apolloConnected ? 'Update' : 'Connect'}
          </button>
        </div>
        {apolloConnected && (
          <div className="mt-3 flex gap-3">
            <Link href="/api/integrations/apollo/sync" className="text-xs text-blue-600 hover:underline">Sync Prospects Now</Link>
            <Link href="/api/integrations/apollo/enrich" className="text-xs text-blue-600 hover:underline">Enrich Contacts</Link>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-one70-dark mb-4 flex items-center gap-2"><Calendar size={16} /> Calendar Sync</h2>
        <p className="text-xs text-gray-500 mb-3">Calendar sync uses your Microsoft 365 connection. Meetings with CRM contacts are automatically tracked.</p>
        <div className="flex gap-4 text-xs">
          {m365Status && <span className="flex items-center gap-1 text-green-600"><Check size={12} /> Outlook Calendar — auto-syncing meetings with CRM contacts</span>}
          {googleConnected && <span className="flex items-center gap-1 text-green-600"><Check size={12} /> Google Calendar connected</span>}
          {!googleConnected && !m365Status && !msConnected && <span className="text-gray-400">Connect Microsoft 365 above to enable automatic calendar tracking</span>}
        </div>
      </div>

      {/* Workflows */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-one70-dark flex items-center gap-2"><Zap size={16} /> Automated Workflows</h2>
          <form action="/api/workflows/seed" method="POST">
            <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 font-medium">Load Default Workflows</button>
          </form>
        </div>

        {workflows.length === 0 ? (
          <p className="text-xs text-gray-400">No workflows configured. Click "Load Default Workflows" to set up auto-project creation on deal won.</p>
        ) : (
          <div className="space-y-3">
            {workflows.map(wf => (
              <div key={wf.id} className="border border-one70-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{wf.name}</h3>
                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Trigger: {triggerLabels[wf.trigger_type] || wf.trigger_type}
                    </span>
                  </div>
                  <button onClick={() => toggleWorkflow(wf.id, !wf.is_active)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      wf.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {wf.is_active ? <><Play size={12} /> Active</> : <><Pause size={12} /> Paused</>}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {(wf.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order).map((a: any, i: number) => (
                    <div key={a.id} className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="font-semibold text-gray-400">{i + 1}.</span>
                      <span className="capitalize">{a.action_type.replace(/_/g, ' ')}</span>
                      {a.action_config?.title && <span className="text-gray-400">— {a.action_config.title}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Writing Style */}
      <WritingStyleProfile />
    </div>
  )
}
