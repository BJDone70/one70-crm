'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContactForm from '@/components/contact-form'
import ContactImportTools from '@/components/contact-import-tools'

export default function NewContactPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || undefined
  const [prefill, setPrefill] = useState<Record<string, string>>({})
  const [imported, setImported] = useState(false)

  function handleImport(data: { first_name: string; last_name: string; title: string; email: string; phone: string; company: string; linkedin_url: string; notes: string }) {
    setPrefill({
      first_name: data.first_name,
      last_name: data.last_name,
      title: data.title,
      email: data.email,
      phone: data.phone,
      linkedin_url: data.linkedin_url,
      notes: data.notes,
    })
    setImported(true)
  }

  return (
    <div>
      <Link href="/contacts" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Contacts
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-4">New Contact</h1>

      <ContactImportTools onImport={handleImport} />

      {imported && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm mb-4">
          Contact imported — review and save below.
        </div>
      )}
      <ContactForm mode="create" defaultOrgId={orgId} prefill={prefill} />
    </div>
  )
}
