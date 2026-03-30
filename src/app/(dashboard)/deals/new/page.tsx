import DealForm from '@/components/deal-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ org_id?: string; contact_id?: string; property_id?: string }> }) {
  const params = await searchParams
  return (
    <div>
      <Link href="/deals" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Pipeline
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">New Deal</h1>
      <DealForm mode="create" defaultOrgId={params.org_id} defaultContactId={params.contact_id} defaultPropertyId={params.property_id} />
    </div>
  )
}
