'use client'

import { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react'
import PillFilter from '@/components/pill-filter'

interface AiDraftProps {
  contactId?: string
  orgId?: string
  dealId?: string
}

const channels = [
  { id: 'email', label: 'Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'text', label: 'Text' },
]

const sequences = [
  { id: 'cold', label: 'Cold Open' },
  { id: 'followUp1', label: 'Follow-up 1' },
  { id: 'followUp2', label: 'Follow-up 2' },
  { id: 'breakup', label: 'Break-up' },
  { id: 'post_meeting', label: 'Post-Meeting' },
  { id: 'referral', label: 'Referral Intro' },
]

export default function AiDraft({ contactId, orgId, dealId }: AiDraftProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [channel, setChannel] = useState('email')
  const [step, setStep] = useState('cold')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    setMessage('')

    const res = await fetch('/api/ai/draft-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, orgId, dealId, channel, sequenceStep: step }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to generate'); setLoading(false); return }
    setMessage(data.message)
    setLoading(false)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-one70-black hover:underline">
        <Sparkles size={14} /> Draft Message with AI
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg border border-one70-yellow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-one70-dark uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={12} /> AI Message Drafter
        </span>
        <button onClick={() => { setOpen(false); setMessage('') }} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Channel</p>
        <PillFilter options={channels} value={channel} onChange={setChannel} allowDeselect={false} />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Sequence Step</p>
        <PillFilter options={sequences} value={step} onChange={setStep} allowDeselect={false} />
      </div>

      <button onClick={generate} disabled={loading}
        className="w-full bg-one70-black text-white py-2 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate Draft</>}
      </button>

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>}

      {message && (
        <div className="relative">
          <pre className="bg-white rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200 max-h-80 overflow-y-auto font-sans">{message}</pre>
          <div className="flex gap-2 mt-2">
            <button onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 bg-one70-black text-white rounded-md text-xs font-medium hover:bg-one70-dark transition-colors">
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
