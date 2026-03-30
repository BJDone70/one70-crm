'use client'

import { useState, useRef, useEffect } from 'react'
import { Smartphone, Upload, UserPlus, Loader2, X, ContactRound } from 'lucide-react'
import { isVCard, parseVCard } from '@/lib/vcard-parser'
import { isNativeApp, pickNativeContact } from '@/lib/native'

interface ImportedContact {
  first_name: string; last_name: string; title: string; email: string
  phone: string; company: string; linkedin_url: string; notes: string
}

interface Props {
  onImport: (data: ImportedContact) => void
}

export default function PhoneContactImport({ onImport }: Props) {
  const [showFallback, setShowFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [canPickDirectly, setCanPickDirectly] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Can pick directly if: Capacitor native app OR Android Chrome Contact Picker API
    setCanPickDirectly(
      isNativeApp() || (
        typeof navigator !== 'undefined' &&
        'contacts' in navigator &&
        'ContactsManager' in window
      )
    )
  }, [])

  async function handleImportClick() {
    setError('')
    setLoading(true)

    // Priority 1: Capacitor native contact picker (iOS + Android app)
    if (isNativeApp()) {
      try {
        const contact = await pickNativeContact()
        if (contact) {
          onImport({ ...contact, linkedin_url: '', notes: '' })
          setLoading(false)
          return
        }
      } catch {}
      // Native picker failed or cancelled — fall through to file picker
    }

    // Priority 2: Browser Contact Picker API (Android Chrome)
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      try {
        const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel', 'address'], { multiple: false })
        if (contacts && contacts.length > 0) {
          const c = contacts[0]
          const names = (c.name?.[0] || '').split(' ')
          onImport({
            first_name: names[0] || '',
            last_name: names.slice(1).join(' ') || '',
            title: '', email: c.email?.[0] || '', phone: c.tel?.[0] || '',
            company: '', linkedin_url: '',
            notes: c.address?.[0] ? `Address: ${Object.values(c.address[0]).filter(Boolean).join(', ')}` : '',
          })
          setLoading(false)
          return
        }
      } catch {}
      // Browser picker failed or cancelled — fall through to file picker
    }

    // Priority 3: Show file upload fallback (always reachable)
    setLoading(false)
    setShowFallback(true)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError('')
    try {
      const text = await file.text()
      if (isVCard(text)) {
        const p = parseVCard(text)
        onImport({
          first_name: p.first_name, last_name: p.last_name, title: p.title,
          email: p.email, phone: p.phone, company: p.company,
          linkedin_url: p.linkedin_url, notes: p.address ? `Address: ${p.address}` : '',
        })
        setShowFallback(false)
      } else {
        setError('Not a valid contact file. Make sure you shared the contact as a .vcf file.')
      }
    } catch { setError('Failed to read the file') }
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Main button — always visible
  if (!showFallback) {
    return (
      <button onClick={handleImportClick} disabled={loading} type="button"
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-one70-border rounded-md text-sm font-medium text-one70-dark hover:bg-one70-gray transition-colors disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ContactRound size={16} />}
        {loading ? 'Opening contacts...' : 'Import from Phone'}
      </button>
    )
  }

  // Fallback panel for devices without Contact Picker API (iPhone, desktop)
  return (
    <div className="bg-white border border-one70-border rounded-lg p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-one70-dark flex items-center gap-2">
          <UserPlus size={16} /> Import Contact from Phone
        </h3>
        <button onClick={() => { setShowFallback(false); setError('') }} type="button" className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm mb-3">{error}</div>}

      <div className="space-y-3">
        <label className={`w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed border-one70-border rounded-md text-sm font-medium text-one70-dark hover:border-one70-yellow hover:bg-one70-gray cursor-pointer transition-colors ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          <div>
            <span className="font-semibold">Upload contact file (.vcf)</span>
            <span className="block text-xs text-gray-400 mt-0.5">Share a contact from your phone, then upload the .vcf file here</span>
          </div>
          <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={handleFileUpload} className="hidden" disabled={loading} />
        </label>

        <div className="bg-gray-50 rounded-md p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">How to share a contact:</p>
          <div className="text-xs text-gray-500 space-y-1.5">
            <p><span className="font-semibold text-gray-700">iPhone:</span> Open Contacts → tap the person → scroll down → tap "Share Contact" → choose "Save to Files" or AirDrop to yourself → then upload the .vcf file above</p>
            <p><span className="font-semibold text-gray-700">Android:</span> Open Contacts → tap the person → tap the share icon → choose "Share as file" or send to yourself → then upload above</p>
          </div>
        </div>
      </div>
    </div>
  )
}
