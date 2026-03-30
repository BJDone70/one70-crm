import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import Documents from '@/components/documents'
import AdminDeleteButton from '@/components/admin-delete'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*, organizations(id, name, vertical)')
    .eq('id', id)
    .single()

  if (!property) notFound()

  const vertical = (property.organizations as any)?.vertical

  // Documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('record_type', 'property')
    .eq('record_id', id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Link href="/properties" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Properties
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-one70-black">{property.name}</h1>
          {property.organizations && (
            <Link href={`/organizations/${(property.organizations as any).id}`} className="text-sm text-blue-600 hover:underline mt-1 inline-block">
              {(property.organizations as any).name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/properties/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-one70-border rounded-md text-sm font-medium hover:bg-one70-gray transition-colors"
          >
            <Pencil size={16} /> Edit
          </Link>
          <AdminDeleteButton table="properties" recordId={id} recordLabel="this property" redirectTo="/properties" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-one70-border p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Property Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {property.address && <div className="sm:col-span-2"><span className="text-one70-mid">Address:</span> <span className="ml-1">{property.address}</span></div>}
          {property.city && <div><span className="text-one70-mid">City:</span> <span className="ml-1">{property.city}</span></div>}
          {property.state && <div><span className="text-one70-mid">State:</span> <span className="ml-1">{property.state}</span></div>}
          {property.property_type && <div><span className="text-one70-mid">Type:</span> <span className="ml-1">{property.property_type}</span></div>}

          {/* Hotel fields */}
          {(vertical === 'hotel' || vertical === 'hospitality') && (
            <>
              {property.key_count && <div><span className="text-one70-mid">Keys:</span> <span className="ml-1">{property.key_count}</span></div>}
              {property.brand_flag && <div><span className="text-one70-mid">Brand:</span> <span className="ml-1">{property.brand_flag}</span></div>}
              {property.pip_status && (
                <div>
                  <span className="text-one70-mid">PIP Status:</span>
                  <span className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    property.pip_status === 'active' ? 'bg-red-100 text-red-800' :
                    property.pip_status === 'upcoming' ? 'bg-amber-100 text-amber-800' :
                    property.pip_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {property.pip_status.charAt(0).toUpperCase() + property.pip_status.slice(1)}
                  </span>
                </div>
              )}
              {property.pip_deadline && <div><span className="text-one70-mid">PIP Deadline:</span> <span className="ml-1">{new Date(property.pip_deadline).toLocaleDateString()}</span></div>}
            </>
          )}

          {/* Property-specific fields */}
          {property.unit_count && (
            <>
              {property.unit_count && <div><span className="text-one70-mid">Units:</span> <span className="ml-1">{property.unit_count}</span></div>}
              {property.common_area_scope && <div className="sm:col-span-2"><span className="text-one70-mid">Scope:</span> <span className="ml-1">{property.common_area_scope}</span></div>}
            </>
          )}

          {/* Senior Living / specialty fields */}
          {(property.bed_count || property.acuity_level) && (
            <>
              {property.bed_count && <div><span className="text-one70-mid">Beds:</span> <span className="ml-1">{property.bed_count}</span></div>}
              {property.acuity_level && <div><span className="text-one70-mid">Acuity:</span> <span className="ml-1 capitalize">{property.acuity_level.replace('_', ' ')}</span></div>}
            </>
          )}
        </div>
        {property.notes && <p className="mt-3 text-sm text-one70-dark border-t border-one70-border pt-3 whitespace-pre-wrap">{property.notes}</p>}
      </div>

      {/* Documents */}
      <Documents recordType="property" recordId={id} documents={documents || []} />
    </div>
  )
}
