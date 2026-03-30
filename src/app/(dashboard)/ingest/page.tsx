'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, Loader2, UserPlus, Handshake, FileText, CheckSquare, ChevronRight, Check, X, Sparkles } from 'lucide-react'

interface ParsedResult {
  contacts: any[]
  summary: string
  suggested_actions: any[]
  deal_info: any
  activity: any
  task: any
  matches: { contacts: any[]; organizations: any[] }
}

interface ActionItem {
  type: string
  label: string
  data: any
  selected: boolean
}

const sourceOptions = [
  { id: 'email', label: 'Email' },
  { id: 'text', label: 'Text / SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'other', label: 'Other' },
]

const actionIcons: Record<string, any> = {
  create_contact: UserPlus,
  create_deal: Handshake,
  log_activity: FileText,
  create_task: CheckSquare,
}

export default function IngestPage() {
  const [text, setText] = useState('')
  const [source, setSource] = useState('email')
  const [processing, setProcessing] = useState(false)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [executing, setExecuting] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [pendingShares, setPendingShares] = useState<any[]>([])
  const router = useRouter()

  // Pick up shared text from iOS Share Sheet (session) or pending shares (DB)
  useEffect(() => {
    const shared = sessionStorage.getItem('one70_shared_text')
    if (shared) {
      setText(shared)
      sessionStorage.removeItem('one70_shared_text')
      setSource('other')
    }

    // Load pending shares from share extension
    async function loadPendingShares() {
      try {
        const res = await fetch('/api/share/pending')
        if (res.ok) {
          const data = await res.json()
          if (data.shares?.length > 0) {
            setPendingShares(data.shares)
          }
        }
      } catch {}
    }
    loadPendingShares()
  }, [])

  async function handleProcess() {
    if (!text.trim()) return
    setProcessing(true)
    setError('')
    setParsed(null)
    setActions([])
    setResults([])

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), source }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Processing failed'); setProcessing(false); return }

      const p = data.parsed
      setParsed(p)

      // Build action list from AI suggestions
      const actionList: ActionItem[] = []

      // Add contacts not already in CRM
      for (const contact of (p.contacts || [])) {
        if (!contact.first_name && !contact.last_name) continue
        const matched = p.matches.contacts.find((m: any) =>
          m.email?.toLowerCase() === contact.email?.toLowerCase() ||
          (m.first_name?.toLowerCase() === contact.first_name?.toLowerCase() && m.last_name?.toLowerCase() === contact.last_name?.toLowerCase())
        )
        if (!matched) {
          actionList.push({
            type: 'create_contact',
            label: `Add contact: ${contact.first_name || ''} ${contact.last_name || ''}${contact.company ? ` (${contact.company})` : ''}`,
            data: contact,
            selected: true,
          })
        }
      }

      // Add deal if mentioned
      if (p.deal_info?.name) {
        const matchedContact = p.matches.contacts[0]
        const matchedOrg = p.matches.organizations[0]
        actionList.push({
          type: 'create_deal',
          label: `Create deal: ${p.deal_info.name}${p.deal_info.value ? ` ($${Number(p.deal_info.value).toLocaleString()})` : ''}`,
          data: {
            ...p.deal_info,
            contact_id: matchedContact?.id || null,
            org_id: matchedOrg?.id || null,
          },
          selected: true,
        })
      }

      // Add activity
      if (p.activity?.subject) {
        const matchedContact = p.matches.contacts[0]
        const matchedOrg = p.matches.organizations[0]
        actionList.push({
          type: 'log_activity',
          label: `Log ${p.activity.type || 'note'}: ${p.activity.subject}`,
          data: {
            ...p.activity,
            contact_id: matchedContact?.id || null,
            org_id: matchedOrg?.id || null,
          },
          selected: true,
        })
      }

      // Add task if implied
      if (p.task?.title) {
        const matchedContact = p.matches.contacts[0]
        const matchedOrg = p.matches.organizations[0]
        actionList.push({
          type: 'create_task',
          label: `Create task: ${p.task.title}`,
          data: {
            ...p.task,
            contact_id: matchedContact?.id || null,
            org_id: matchedOrg?.id || null,
          },
          selected: true,
        })
      }

      // Add AI suggestions not already covered
      for (const suggestion of (p.suggested_actions || [])) {
        const alreadyCovered = actionList.some(a => a.type === suggestion.type && a.label === suggestion.label)
        if (!alreadyCovered && suggestion.label) {
          actionList.push({ ...suggestion, selected: false })
        }
      }

      setActions(actionList)
    } catch {
      setError('Failed to process. Try again.')
    }
    setProcessing(false)
  }

  function toggleAction(index: number) {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, selected: !a.selected } : a))
  }

  async function executeActions() {
    const selected = actions.filter(a => a.selected)
    if (selected.length === 0) return
    setExecuting(true)

    try {
      const res = await fetch('/api/ingest', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: selected }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setError('Failed to execute actions')
    }
    setExecuting(false)
  }

  function reset() {
    setText('')
    setParsed(null)
    setActions([])
    setResults([])
    setError('')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-one70-black mb-1">Paste & Process</h1>
      <p className="text-sm text-one70-mid mb-6">Paste any email, text, WhatsApp message, or note. AI will extract contacts, deals, and next steps into the CRM.</p>

      {/* Pending shares from iOS Share Extension */}
      {pendingShares.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-xs font-semibold text-yellow-800 mb-2">Shared from iOS ({pendingShares.length})</p>
          {pendingShares.map((share: any) => (
            <div key={share.id} className="flex items-start gap-2 mb-2 last:mb-0">
              <button
                onClick={() => {
                  setText(share.text)
                  setSource('other')
                  // Mark as processed
                  fetch('/api/share/pending', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: share.id }) })
                  setPendingShares(prev => prev.filter(s => s.id !== share.id))
                }}
                className="flex-1 text-left text-xs text-one70-dark bg-white rounded p-2 border border-yellow-200 hover:border-one70-yellow transition-colors line-clamp-2">
                {share.text.substring(0, 120)}{share.text.length > 120 ? '...' : ''}
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <>
          {/* Source selector */}
          <div className="flex gap-2 mb-4">
            {sourceOptions.map(s => (
              <button key={s.id} onClick={() => setSource(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  source === s.id ? 'bg-one70-black text-white' : 'bg-one70-gray text-one70-mid hover:bg-gray-200'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Paste area */}
          <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Paste the email, text message, or conversation here...\n\nExamples:\n• A forwarded email from a prospect\n• A WhatsApp message about a project\n• A LinkedIn message from a new contact\n• Notes from a phone call'}
              className="w-full min-h-[200px] text-sm border-0 focus:outline-none resize-none text-one70-dark placeholder:text-gray-300"
              disabled={processing}
            />
          </div>

          <button onClick={handleProcess} disabled={processing || !text.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors mb-6">
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {processing ? 'Processing...' : 'Process with AI'}
          </button>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          {/* AI Results */}
          {parsed && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">{parsed.summary}</p>
              </div>

              {/* Matched records */}
              {(parsed.matches.contacts.length > 0 || parsed.matches.organizations.length > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-800 mb-2">Matched existing records:</p>
                  {parsed.matches.contacts.map((c: any, i: number) => (
                    <button key={i} onClick={() => router.push(`/contacts/${c.id}`)}
                      className="flex items-center gap-1.5 text-sm text-green-700 hover:underline">
                      <ChevronRight size={12} /> {c.first_name} {c.last_name}
                      {(c as any).organizations?.name && <span className="text-green-500">({(c as any).organizations.name})</span>}
                      <span className="text-[10px] text-green-500">— matched by {c.matched_by}</span>
                    </button>
                  ))}
                  {parsed.matches.organizations.map((o: any, i: number) => (
                    <button key={i} onClick={() => router.push(`/organizations/${o.id}`)}
                      className="flex items-center gap-1.5 text-sm text-green-700 hover:underline">
                      <ChevronRight size={12} /> {o.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Actions to execute */}
              {actions.length > 0 && (
                <div className="bg-white rounded-lg border border-one70-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-one70-border bg-one70-gray">
                    <p className="text-sm font-semibold text-one70-black">Suggested Actions</p>
                    <p className="text-xs text-one70-mid">Select which actions to execute.</p>
                  </div>
                  <div className="divide-y divide-one70-border">
                    {actions.map((action, i) => {
                      const Icon = actionIcons[action.type] || FileText
                      return (
                        <button key={i} onClick={() => toggleAction(i)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            action.selected ? 'bg-one70-gray/50' : 'hover:bg-one70-gray/30'
                          }`}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                            action.selected ? 'bg-one70-black border-one70-black' : 'border-gray-300'
                          }`}>
                            {action.selected && <Check size={12} className="text-white" />}
                          </div>
                          <Icon size={16} className="text-one70-mid shrink-0" />
                          <span className="text-sm text-one70-dark">{action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="px-4 py-3 border-t border-one70-border flex items-center gap-3">
                    <button onClick={executeActions} disabled={executing || !actions.some(a => a.selected)}
                      className="flex items-center gap-2 px-5 py-2 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50">
                      {executing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {executing ? 'Creating...' : `Execute ${actions.filter(a => a.selected).length} action${actions.filter(a => a.selected).length !== 1 ? 's' : ''}`}
                    </button>
                    <button onClick={reset} className="text-sm text-one70-mid hover:text-one70-dark">Cancel</button>
                  </div>
                </div>
              )}

              {actions.length === 0 && !processing && (
                <div className="bg-one70-gray rounded-lg p-4 text-center">
                  <p className="text-sm text-one70-mid">All contacts found are already in the CRM. No new actions needed.</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Results */
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
              <Check size={18} /> Actions Complete
            </h2>
            <div className="space-y-2">
              {results.map((r: any, i: number) => {
                const Icon = actionIcons[r.type] || FileText
                return (
                  <div key={i} className="flex items-center gap-2">
                    {r.success ? (
                      <Check size={14} className="text-green-600" />
                    ) : (
                      <X size={14} className="text-red-500" />
                    )}
                    <Icon size={14} className="text-green-700" />
                    <span className="text-sm text-green-800">{r.label}</span>
                    {r.link && (
                      <button onClick={() => router.push(r.link)}
                        className="text-xs text-green-600 hover:underline ml-1">View →</button>
                    )}
                    {r.error && <span className="text-xs text-red-500 ml-1">{r.error}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="px-5 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark">
              Process Another
            </button>
            <button onClick={() => router.push('/')}
              className="px-4 py-2.5 text-sm text-one70-mid hover:text-one70-dark">
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
