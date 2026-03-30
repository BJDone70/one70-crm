import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DealForm from '@/components/deal-form'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (!deal) notFound()

  return (
    <div>
      <Link href={`/deals/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Deal
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Deal</h1>
      <DealForm mode="edit" initialData={deal} />
    </div>
  )
}
