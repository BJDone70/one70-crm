'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, QrCode, Smartphone, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { isVCard, parseVCard } from '@/lib/vcard-parser'

interface ImportedData {
  first_name: string; last_name: string; title: string; email: string
  phone: string; company: string; linkedin_url: string; notes: string
}

interface Props {
  onImport: (data: ImportedData) => void
}

function parseMeCard(text: string): any {
  const contact: any = { first_name: '', last_name: '', title: '', company: '', email: '', phone: '', linkedin_url: '' }
  const fields = text.replace('MECARD:', '').split(';')
  for (const field of fields) {
    const [key, ...rest] = field.split(':')
    const value = rest.join(':')
    switch (key?.toUpperCase()) {
      case 'N': { const p = value.split(','); contact.last_name = p[0]?.trim() || ''; contact.first_name = p[1]?.trim() || ''; break }
      case 'TEL': contact.phone = value; break
      case 'EMAIL': contact.email = value; break
      case 'ORG': contact.company = value; break
      case 'TITLE': contact.title = value; break
      case 'URL': if (value.toLowerCase().includes('linkedin')) contact.linkedin_url = value; break
    }
  }
  return contact
}

export default function ContactImportTools({ onImport }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrScannerRef = useRef<any>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)

  function applyContact(contact: any) {
    onImport({
      first_name: contact.first_name || '', last_name: contact.last_name || '',
      title: contact.title || '', email: contact.email || '', phone: contact.phone || '',
      company: contact.company || '', linkedin_url: contact.linkedin_url || '',
      notes: contact.address ? `Address: ${contact.address}` : '',
    })
    setExpanded(false)
  }

  // Business card photo scan
  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true); setError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject; reader.readAsDataURL(file)
      })
      const res = await fetch('/api/scan-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64 }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not read the card'); setScanning(false); return }
      if (data.contact) applyContact(data.contact)
    } catch { setError('Failed to process the image') }
    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // VCF file import
  async function handleVcfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return; setError('')
    try {
      const text = await file.text()
      if (isVCard(text)) { applyContact(parseVCard(text)) }
      else { setError('File does not appear to be a valid .vcf contact file') }
    } catch { setError('Failed to read contact file') }
    e.target.value = ''
  }

  // QR scanner
  const handleQrResult = useCallback(async (decodedText: string) => {
    stopQrScanner(); setScanning(true); setError('')
    try {
      if (isVCard(decodedText)) { applyContact(parseVCard(decodedText)); setScanning(false); return }
      if (decodedText.startsWith('MECARD:')) { applyContact(parseMeCard(decodedText)); setScanning(false); return }
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const res = await fetch('/api/scan-qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: decodedText }) })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Could not extract contact info'); setScanning(false); return }
        if (data.contact) applyContact(data.contact); setScanning(false); return
      }
      setError('QR code format not recognized')
    } catch { setError('Failed to process QR code') }
    setScanning(false)
  }, [])

  async function startQrScanner() {
    setError(''); setQrScanning(true)
    const { Html5Qrcode } = await import('html5-qrcode')
    await new Promise(r => setTimeout(r, 100))
    if (!qrContainerRef.current) return
    try {
      const scanner = new Html5Qrcode('qr-reader-full')
      qrScannerRef.current = scanner
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, (t) => handleQrResult(t), () => {})
    } catch (err: any) {
      setError(err.message?.includes('NotAllowed') ? 'Camera permission denied.' : 'Could not start camera.')
      setQrScanning(false)
    }
  }

  function stopQrScanner() {
    if (qrScannerRef.current) {
      try { qrScannerRef.current.stop().catch(() => {}); qrScannerRef.current.clear().catch(() => {}) } catch {}
      qrScannerRef.current = null
    }
    setQrScanning(false)
  }

  useEffect(() => { return () => { stopQrScanner() } }, [])

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} type="button"
        className="flex items-center gap-2 text-sm font-medium text-one70-dark hover:text-one70-black transition-colors mb-4">
        <ChevronDown size={16} /> Import from phone, business card, or QR code
      </button>
    )
  }

  return (
    <div className="bg-white border border-one70-border rounded-lg p-5 mb-4">
      <button onClick={() => { setExpanded(false); stopQrScanner(); setError('') }} type="button"
        className="flex items-center gap-2 text-sm font-medium text-one70-dark hover:text-one70-black transition-colors mb-3">
        <ChevronUp size={16} /> Hide import tools
      </button>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm mb-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <label className="flex items-center justify-center gap-2 px-3 py-3 bg-one70-black text-white rounded-md text-sm font-medium cursor-pointer hover:bg-one70-dark transition-colors">
          <Camera size={18} />
          {scanning && !qrScanning ? 'Reading...' : 'Photo Scan'}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" disabled={scanning} />
        </label>
        <button onClick={qrScanning ? stopQrScanner : startQrScanner} disabled={scanning && !qrScanning} type="button"
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-md text-sm font-medium transition-colors ${qrScanning ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-one70-black text-white hover:bg-one70-dark'} disabled:opacity-50`}>
          <QrCode size={18} /> {qrScanning ? 'Stop QR' : 'Scan QR'}
        </button>
        <button type="button" onClick={async () => {
          setError('')
          // Priority 1: Capacitor native contact picker (iOS + Android app)
          if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
            try {
              const { pickNativeContact } = await import('@/lib/native')
              const contact = await pickNativeContact()
              if (contact) { applyContact(contact); return }
            } catch {}
            // Native picker failed or cancelled — fall through to file picker
          }
          // Priority 2: Browser Contact Picker API (Android Chrome)
          if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
            try {
              const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel', 'address'], { multiple: false })
              if (contacts && contacts.length > 0) {
                const c = contacts[0]; const names = (c.name?.[0] || '').split(' ')
                applyContact({ first_name: names[0] || '', last_name: names.slice(1).join(' ') || '', title: '', email: c.email?.[0] || '', phone: c.tel?.[0] || '', company: '', linkedin_url: '' })
                return
              }
            } catch {}
          }
          // Priority 3: Fallback to file picker (always reachable)
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.vcf,text/vcard,text/x-vcard'
          input.onchange = (ev) => handleVcfUpload(ev as any)
          input.click()
        }} className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-one70-border rounded-md text-sm font-medium text-one70-dark hover:border-one70-yellow hover:bg-one70-gray cursor-pointer transition-colors">
          <Smartphone size={18} /> Import from Phone
        </button>
      </div>

      {qrScanning && (
        <div className="mb-3 rounded-lg overflow-hidden border-2 border-one70-yellow">
          <div id="qr-reader-full" ref={qrContainerRef} className="w-full" />
        </div>
      )}

      {scanning && !qrScanning && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3"><Loader2 size={16} className="animate-spin" /> Analyzing with AI...</div>
      )}

      <p className="text-[10px] text-gray-400">Photo Scan reads printed business cards. QR Scan reads digital cards (Popl, Linq, HiHello). Import .vcf works with contacts shared from your phone.</p>
    </div>
  )
}
