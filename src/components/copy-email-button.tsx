'use client'

import { useState } from 'react'
import { Copy, CheckCircle } from 'lucide-react'

export default function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('input')
      el.value = email
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all"
    >
      {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
      {copied ? 'Copied!' : 'Copy Email'}
    </button>
  )
}
