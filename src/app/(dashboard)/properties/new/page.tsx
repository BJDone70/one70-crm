import PropertyForm from '@/components/property-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ org_id?: string }> }) {
  const params = await searchParams
  return (
    <div>
      <Link href="/properties" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Properties
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">New Property</h1>
      <PropertyForm mode="create" defaultOrgId={params.org_id} />
    </div>
  )
}
