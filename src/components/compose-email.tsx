'use client'

import { useState } from 'react'
import { Send, X, Loader2, ChevronDown, ChevronUp, Paperclip, CheckCircle, Sparkles } from 'lucide-react'
import RecipientInput from '@/components/recipient-input'

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
  const [drafting, setDrafting] = useState(false)

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
