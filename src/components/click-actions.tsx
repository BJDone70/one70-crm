'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Phone, Mail, MessageSquare, CheckCircle, X, Copy } from 'lucide-react'

interface ActionButtonProps {
  contactId?: string
  orgId?: string
  dealId?: string
  value: string
  contactName?: string
}

// Small inline confirmation that appears after clicking — asks if the action actually happened
function LogConfirm({ label, onLog, onDismiss }: { label: string; onLog: () => void; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 ml-1 text-xs">
      <span className="text-gray-500">{label}?</span>
      <button onClick={onLog} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium">
        <CheckCircle size={11} /> Yes
      </button>
      <button onClick={onDismiss} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors">
        <X size={11} /> No
      </button>
    </span>
  )
}

export function ClickToCall({ contactId, orgId, dealId, value, contactName }: ActionButtonProps) {
  const supabase = createClient()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [logged, setLogged] = useState(false)

  async function handleCall() {
    // Open the dialer immediately
    const link = document.createElement('a')
    link.href = `tel:${value.replace(/[^+\d]/g, '')}`
    link.click()
    // Then ask if the call happened
    setConfirm(true)
    setLogged(false)
  }

  async function logActivity() {
    setConfirm(false)
    setLogged(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('activities').insert({
        type: 'call',
        subject: `Called ${contactName || value}`,
        direction: 'outbound',
        contact_id: contactId || null,
        org_id: orgId || null,
        deal_id: dealId || null,
        user_id: user.id,
      })
      window.dispatchEvent(new Event('timeline-refresh'))
      router.refresh()
    }
  }

  return (
    <span className="inline-flex items-center flex-wrap gap-1">
      <button onClick={handleCall}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
        title={`Call ${value}`}>
        <Phone size={13} />
        <span className="hidden sm:inline">{value}</span>
        <span className="sm:hidden">Call</span>
      </button>
      {confirm && <LogConfirm label="Log call" onLog={logActivity} onDismiss={() => setConfirm(false)} />}
      {logged && <span className="text-[11px] text-green-600">✓ Logged</span>}
    </span>
  )
}

export function ClickToText({ contactId, orgId, dealId, value, contactName }: ActionButtonProps) {
  const supabase = createClient()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [logged, setLogged] = useState(false)

  async function handleText() {
    const link = document.createElement('a')
    link.href = `sms:${value.replace(/[^+\d]/g, '')}`
    link.click()
    setConfirm(true)
    setLogged(false)
  }

  async function logActivity() {
    setConfirm(false)
    setLogged(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('activities').insert({
        type: 'text',
        subject: `Texted ${contactName || value}`,
        direction: 'outbound',
        contact_id: contactId || null,
        org_id: orgId || null,
        deal_id: dealId || null,
        user_id: user.id,
      })
      window.dispatchEvent(new Event('timeline-refresh'))
      router.refresh()
    }
  }

  return (
    <span className="inline-flex items-center flex-wrap gap-1">
      <button onClick={handleText}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
        title={`Text ${value}`}>
        <MessageSquare size={13} />
        <span className="hidden sm:inline">Text</span>
        <span className="sm:hidden">Text</span>
      </button>
      {confirm && <LogConfirm label="Log text" onLog={logActivity} onDismiss={() => setConfirm(false)} />}
      {logged && <span className="text-[11px] text-green-600">✓ Logged</span>}
    </span>
  )
}

export function ClickToEmail({ contactId, orgId, dealId, value, contactName }: ActionButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers/WebViews
      const el = document.createElement('input')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <span className="inline-flex items-center flex-wrap gap-1">
      <button onClick={handleCopyEmail}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
        title={`Copy ${value}`}>
        {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
        <span>{copied ? 'Copied!' : 'Copy Email'}</span>
      </button>
    </span>
  )
}
