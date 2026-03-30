'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X, Users, Building2, Columns3, CalendarCheck, Camera, QrCode, Loader2, Smartphone, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { isVCard, parseVCard } from '@/lib/vcard-parser'

export default function QuickAddButton() {
  const [open, setOpen] = useState(false)
  const [contactModal, setContactModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanError, setScanError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const qrScannerRef = useRef<any>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    first_name: '', last_name: '', title: '', email: '', phone: '',
    linkedin_url: '', company: '', notes: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function reset() {
    setForm({ first_name: '', last_name: '', title: '', email: '', phone: '', linkedin_url: '', company: '', notes: '' })
    setError('')
    setScanError('')
  }

  function handleClose() {
    stopQrScanner()
    setContactModal(false)
    setOpen(false)
    reset()
  }

  // Apply parsed contact data to form
  function applyContact(contact: any) {
    setForm(prev => ({
      ...prev,
      first_name: contact.first_name || prev.first_name,
      last_name: contact.last_name || prev.last_name,
      title: contact.title || prev.title,
      email: contact.email || prev.email,
      phone: contact.phone || prev.phone,
      linkedin_url: contact.linkedin_url || prev.linkedin_url,
      company: contact.company || prev.company,
    }))
  }

  // ---- Business card photo scan ----
  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (!res.ok) { setScanError(data.error || 'Could not read the card'); setScanning(false); return }
      if (data.contact) applyContact(data.contact)
    } catch { setScanError('Failed to process the image') }
    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // ---- VCF file import (from phone contacts) ----
  async function handleVcfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError('')
    try {
      const text = await file.text()
      if (isVCard(text)) {
        const contact = parseVCard(text)
        applyContact(contact)
      } else {
        setScanError('File does not appear to be a valid .vcf contact file')
      }
    } catch { setScanError('Failed to read contact file') }
    e.target.value = ''
  }

  // ---- QR code scanner ----
  const handleQrResult = useCallback(async (decodedText: string) => {
    // Stop scanner immediately
    stopQrScanner()
    setScanning(true)
    setScanError('')

    try {
      // Check if it's a vCard
      if (isVCard(decodedText)) {
        const contact = parseVCard(decodedText)
        applyContact(contact)
        setScanning(false)
        return
      }

      // Check if it's a MECARD format (some Android cards use this)
      if (decodedText.startsWith('MECARD:')) {
        const contact = parseMeCard(decodedText)
        applyContact(contact)
        setScanning(false)
        return
      }

      // Check if it's a URL — fetch and extract via Claude
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const res = await fetch('/api/scan-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: decodedText }),
        })
        const data = await res.json()
        if (!res.ok) {
          setScanError(data.error || 'Could not extract contact info from this QR code')
          setScanning(false)
          return
        }
        if (data.contact) applyContact(data.contact)
        setScanning(false)
        return
      }

      // Unknown format
      setScanError('QR code scanned but format not recognized. Try scanning a digital business card or vCard QR code.')
    } catch {
      setScanError('Failed to process QR code')
    }
    setScanning(false)
  }, [])

  async function startQrScanner() {
    setScanError('')
    setQrScanning(true)

    // Dynamic import to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode')

    // Small delay to let the container render
    await new Promise(r => setTimeout(r, 100))

    if (!qrContainerRef.current) return

    try {
      const scanner = new Html5Qrcode('qr-reader')
      qrScannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrResult(decodedText)
        },
        () => {} // Ignore scan failures (normal during scanning)
      )
    } catch (err: any) {
      setScanError(err.message?.includes('NotAllowed')
        ? 'Camera permission denied. Please allow camera access.'
        : 'Could not start camera. Try the photo scan instead.')
      setQrScanning(false)
    }
  }

  function stopQrScanner() {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop().catch(() => {})
        qrScannerRef.current.clear().catch(() => {})
      } catch {}
      qrScannerRef.current = null
    }
    setQrScanning(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopQrScanner() }
  }, [])

  // ---- MECARD parser ----
  function parseMeCard(text: string): any {
    const contact: any = { first_name: '', last_name: '', title: '', company: '', email: '', phone: '', linkedin_url: '', website: '' }
    const fields = text.replace('MECARD:', '').split(';')
    for (const field of fields) {
      const [key, ...rest] = field.split(':')
      const value = rest.join(':')
      switch (key?.toUpperCase()) {
        case 'N': {
          const parts = value.split(',')
          contact.last_name = parts[0]?.trim() || ''
          contact.first_name = parts[1]?.trim() || ''
          break
        }
        case 'TEL': contact.phone = value; break
        case 'EMAIL': contact.email = value; break
        case 'ORG': contact.company = value; break
        case 'TITLE': contact.title = value; break
        case 'URL':
          if (value.toLowerCase().includes('linkedin')) contact.linkedin_url = value
          else contact.website = value
          break
      }
    }
    return contact
  }

  // ---- Save contact ----
  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name) { setError('First and last name are required'); return }
    setSaving(true)
    setError('')
    const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ')
    const firstName = titleCase(form.first_name)
    const lastName = titleCase(form.last_name)
    let orgId = null
    if (form.company) {
      const { data: orgs } = await supabase.from('organizations').select('id').is('deleted_at', null).ilike('name', `%${form.company}%`).limit(1)
      if (orgs && orgs.length > 0) {
        orgId = orgs[0].id
      } else {
        const { data: newOrg } = await supabase.from('organizations').insert({
          name: form.company.trim(),
          vertical: 'multifamily',
        }).select('id').single()
        if (newOrg) orgId = newOrg.id
      }
    }
    const { data, error: insertError } = await supabase.from('contacts').insert({
      first_name: firstName, last_name: lastName,
      title: form.title || null, email: form.email || null, phone: form.phone || null,
      linkedin_url: form.linkedin_url || null, org_id: orgId,
      notes: form.notes || null,
    }).select().single()
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSaving(false)
    handleClose()
    router.refresh()
    if (data) router.push(`/contacts/${data.id}`)
  }

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"

  const menuItems = [
    { label: 'Contact', icon: Users, action: () => { setOpen(false); setContactModal(true) } },
    { label: 'Company', icon: Building2, href: '/organizations/new' },
    { label: 'Deal', icon: Columns3, href: '/deals/new' },
    { label: 'Task', icon: CalendarCheck, href: '/tasks/new' },
  ]

  return (
    <>
      {/* Speed dial overlay */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="fixed flex flex-col gap-2 items-end right-4 lg:right-6 lg:bottom-24"
            style={{ bottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}>
            {menuItems.map((item) => {
              const Icon = item.icon
              const content = (
                <div className="flex items-center gap-3 bg-white rounded-lg shadow-lg border border-one70-border px-4 py-3 hover:bg-one70-gray transition-colors cursor-pointer">
                  <Icon size={18} className="text-one70-black" />
                  <span className="text-sm font-medium text-one70-black">{item.label}</span>
                </div>
              )
              if (item.href) return <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>{content}</Link>
              return <button key={item.label} onClick={item.action}>{content}</button>
            })}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all right-4 lg:right-6 lg:bottom-6 ${
          open ? 'bg-one70-yellow text-one70-black rotate-45' : 'bg-one70-black text-white hover:bg-one70-dark'
        }`}
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
        title="Quick Add"
      >
        <Plus size={24} />
      </button>

      {/* Contact modal */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Quick Add Contact</h2>
              <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-md"><X size={20} className="text-gray-500" /></button>
            </div>

            {/* Scan options */}
            <div className="px-5 pt-4">
              <div className="flex gap-2 mb-3">
                <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3 bg-one70-black text-white rounded-md text-xs font-medium cursor-pointer hover:bg-one70-dark transition-colors">
                  <Camera size={16} />
                  {scanning && !qrScanning ? 'Reading...' : 'Camera'}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" disabled={scanning} />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3 bg-one70-black text-white rounded-md text-xs font-medium cursor-pointer hover:bg-one70-dark transition-colors">
                  <ImageIcon size={16} />
                  {scanning && !qrScanning ? 'Reading...' : 'Photo'}
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handleCameraCapture} className="hidden" disabled={scanning} />
                </label>
                <button
                  onClick={qrScanning ? stopQrScanner : startQrScanner}
                  disabled={scanning && !qrScanning}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 rounded-md text-xs font-medium transition-colors ${
                    qrScanning
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-one70-black text-white hover:bg-one70-dark'
                  } disabled:opacity-50`}
                >
                  <QrCode size={16} />
                  {qrScanning ? 'Stop QR' : 'QR Code'}
                </button>
              </div>

              {/* Import from phone */}
              <div className="mb-3">
                <button type="button" onClick={async () => {
                  setScanError('')
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
                  input.onchange = async (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return
                    try { const text = await file.text(); if (isVCard(text)) { applyContact(parseVCard(text)) } else { setScanError('Not a valid .vcf contact file') } } catch { setScanError('Failed to read file') }
                  }
                  input.click()
                }} className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-one70-border rounded-md text-sm font-medium text-one70-dark hover:border-one70-yellow hover:bg-one70-gray transition-colors">
                  <Smartphone size={18} />
                  Import from Phone
                </button>
              </div>

              {/* QR scanner view */}
              {qrScanning && (
                <div className="mb-3 rounded-lg overflow-hidden border-2 border-one70-yellow">
                  <div id="qr-reader" ref={qrContainerRef} className="w-full" />
                </div>
              )}

              {scanning && !qrScanning && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing with AI...
                </div>
              )}
              {scanning && qrScanning && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Loader2 size={16} className="animate-spin" />
                  Processing QR code...
                </div>
              )}
              {scanError && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm mb-3">{scanError}</div>
              )}

              <p className="text-[10px] text-gray-400 mb-3">Photo Scan reads printed business cards. QR Scan reads digital business cards (Popl, Linq, HiHello, vCard QR codes).</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveContact} className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputClass} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputClass} required /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Title</label><input type="text" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} placeholder="e.g. VP of Construction" /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Company</label><input type="text" value={form.company} onChange={e => update('company', e.target.value)} className={inputClass} placeholder="Matches existing or creates new org" /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass} /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn</label><input type="text" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} className={inputClass} /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={inputClass} rows={2} /></div>
              </div>
              {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm mt-3">{error}</div>}
              <button type="submit" disabled={saving} className="w-full mt-4 bg-one70-black text-white py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
