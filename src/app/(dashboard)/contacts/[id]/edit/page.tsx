import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContactForm from '@/components/contact-form'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: contact } = await supabase.from('contacts').select('*').eq('id', id).single()
  if (!contact) notFound()

  return (
    <div>
      <Link href={`/contacts/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to {contact.first_name} {contact.last_name}
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Contact</h1>
      <ContactForm mode="edit" initialData={contact} />
    </div>
  )
}
