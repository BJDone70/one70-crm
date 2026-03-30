'use client'

import { useState } from 'react'
import { Send, X, Loader2, ChevronDown, ChevronUp, Paperclip, CheckCircle, Sparkles, RefreshCw } from 'lucide-react'
import RecipientInput from '@/components/recipient-input'

const AI_SEQUENCE_STEPS = [
  { id: 'cold', label: 'Cold Open' },
  { id: 'followUp1', label: 'Follow-up 1' },
  { id: 'followUp2', label: 'Follow-up 2' },
  { id: 'breakup', label: 'Break-up' },
  { id: 'post_meeting', label: 'Post-Meeting' },
  { id: 'referral', label: 'Referral Intro' },
]

interface Props {
  defaultTo?: string
  defaultSubject?: string
  contactId?: string
  orgId?: string
  dealId?: string
  contactName?: string
  onSent?: () => void
  compact?: boolean
}

export default function ComposeEmail({ defaultTo, defaultSubject, contactId, orgId, dealId, contactName, onSent, compact }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [to, setTo] = useState(defaultTo || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(defaultSubject || '')
  const [body, setBody] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStep, setAiStep] = useState('cold')
  const [aiError, setAiError] = useState('')

  async function handleAiDraft() {
    setAiLoading(true)
    setAiError('')

    const res = await fetch('/api/ai/draft-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, orgId, dealId, channel: 'email', sequenceStep: aiStep }),
    })

    const data = await res.json()
    setAiLoading(false)

    if (!res.ok || !data.success) {
      setAiError(data.error || 'Failed to generate draft')
      return
    }

    // Parse subject line from AI response (format: "Subject: ...\n\n...")
    const msg = data.message || ''
    const subjectMatch = msg.match(/^(?:Subject:\s*)(.+)/i)
    if (subjectMatch) {
      setSubject(subjectMatch[1].trim())
      const bodyStart = msg.indexOf('\n', subjectMatch.index! + subjectMatch[0].length)
      setBody(msg.slice(bodyStart).replace(/^\n+/, ''))
    } else {
      setBody(msg)
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim()) { setError('Recipient and subject are required'); return }
    setSending(true)
    setError('')

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.split(',').map(e => e.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : undefined,
        subject,
        body: body.replace(/\n/g, '<br>'),
        contact_id: contactId,
        org_id: orgId,
        deal_id: dealId,
      }),
    })

    const data = await res.json()
    setSending(false)

    if (data.success) {
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setExpanded(false)
        setSubject(defaultSubject || '')
        setBody('')
        setCc('')
        onSent?.()
      }, 2000)
    } else {
      setError(data.error || 'Failed to send')
    }
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className={`flex items-center gap-2 ${compact
          ? 'text-xs text-blue-600 hover:text-blue-800'
          : 'px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all'
        }`}>
        <Send size={compact ? 12 : 14} /> {compact ? 'Send Email' : `Email${contactName ? ` ${contactName}` : ''}`}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white">
        <span className="text-sm font-semibold">
          {sent ? 'Sent!' : `New Email${contactName ? ` to ${contactName}` : ''}`}
        </span>
        <button onClick={() => setExpanded(false)} className="p-1 hover:bg-white/20 rounded"><X size={16} /></button>
      </div>

      {sent ? (
        <div className="px-4 py-6 text-center">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm text-green-700 font-medium">Email sent successfully</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-one70-mid w-8 shrink-0">To:</span>
            <RecipientInput value={to} onChange={setTo} placeholder="Type name or email..." />
            <button onClick={() => setShowCc(!showCc)} className="text-xs text-blue-600 shrink-0">
              {showCc ? 'Hide CC' : 'CC'}
            </button>
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-one70-mid w-8 shrink-0">CC:</span>
              <RecipientInput value={cc} onChange={setCc} placeholder="Type name or email..." />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-one70-mid w-8 shrink-0">Subj:</span>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm border border-one70-border rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500" />
          </div>

          {/* AI Draft toolbar */}
          <div className="border border-amber-200 rounded-md overflow-hidden">
            <button onClick={() => setAiOpen(!aiOpen)}
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors">
              <Sparkles size={12} />
              AI Draft
              {aiOpen ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
            </button>
            {aiOpen && (
              <div className="px-2.5 py-2 bg-amber-50/50 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {AI_SEQUENCE_STEPS.map(s => (
                    <button key={s.id} onClick={() => setAiStep(s.id)}
                      className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        aiStep === s.id ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <button onClick={handleAiDraft} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-one70-black text-white rounded text-xs font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
                  {aiLoading ? <><RefreshCw size={12} className="animate-spin" /> Generating...</> : <><Sparkles size={12} /> Generate Draft</>}
                </button>
                {aiError && <p className="text-xs text-red-600">{aiError}</p>}
              </div>
            )}
          </div>

          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={5}
            className="w-full text-sm border border-one70-border rounded px-2.5 py-2 focus:outline-none focus:border-blue-500 resize-none" />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-gray-400">Sent via Microsoft 365</p>
            <div className="flex gap-2">
              <button onClick={() => setExpanded(false)} className="px-3 py-1.5 text-xs text-one70-mid hover:text-one70-dark">Cancel</button>
              <button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-30 active:scale-95 transition-all">
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
