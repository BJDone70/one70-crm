import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PropertyForm from '@/components/property-form'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: property } = await supabase.from('properties').select('*').eq('id', id).single()
  if (!property) notFound()

  return (
    <div>
      <Link href={`/properties/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to {property.name}
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Property</h1>
      <PropertyForm mode="edit" initialData={property} />
    </div>
  )
}
