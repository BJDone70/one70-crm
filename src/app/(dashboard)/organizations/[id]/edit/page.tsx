import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OrgForm from '@/components/org-form'

export default async function EditOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('*').eq('id', id).single()
  if (!org) notFound()

  return (
    <div>
      <Link href={`/organizations/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to {org.name}
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Organization</h1>
      <OrgForm mode="edit" initialData={org} />
    </div>
  )
}
