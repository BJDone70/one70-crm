'use client'

import { useState } from 'react'
import { FileText, Sparkles, RefreshCw, Copy, Check } from 'lucide-react'

interface MeetingPrepProps {
  contactId?: string
  orgId?: string
  dealId?: string
}

export default function MeetingPrep({ contactId, orgId, dealId }: MeetingPrepProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/ai/meeting-prep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, orgId, dealId }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to generate'); setLoading(false); return }
    setBrief(data.brief)
    setLoading(false)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); generate() }}
        className="flex items-center gap-1.5 text-sm font-medium text-one70-black hover:underline">
        <FileText size={14} /> Meeting Prep Brief
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-one70-dark uppercase tracking-wider flex items-center gap-1">
          <FileText size={12} /> Meeting Prep Brief
        </span>
        <button onClick={() => { setOpen(false); setBrief('') }} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Sparkles size={16} className="animate-pulse text-blue-500" />
          Preparing your brief...
        </div>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>}

      {brief && (
        <div>
          <pre className="bg-white rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200 max-h-96 overflow-y-auto font-sans">{brief}</pre>
          <div className="flex gap-2 mt-2">
            <button onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 bg-one70-black text-white rounded-md text-xs font-medium hover:bg-one70-dark transition-colors">
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
