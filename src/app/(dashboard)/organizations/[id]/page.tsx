import SetPageContext from "@/components/set-page-context"
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Building2, Users, MapPin, Phone, Globe, Activity } from 'lucide-react'
import AddActivityForm from '@/components/add-activity-form'
import AddTaskForm from '@/components/add-task-form'
import { ClickToCall, ClickToEmail, ClickToText } from '@/components/click-actions'
import AiDraft from '@/components/ai-draft'
import MeetingPrep from '@/components/ai-meeting-prep'
import NoteProcessor from '@/components/ai-note-processor'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'
import { getOrgRoleLabel } from '@/lib/org-roles'
import Documents from '@/components/documents'
import AdminDeleteButton from '@/components/admin-delete'
import MobileSectionNav from '@/components/mobile-section-nav'

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('*').eq('id', id).single()
  if (!org) notFound()

  // Parallelize all remaining queries
  const [contactsRes, propertiesRes, activitiesRes, documentsRes] = await Promise.all([
    supabase.from('contacts').select('*').eq('org_id', id).is('deleted_at', null).order('is_decision_maker', { ascending: false }).order('last_name'),
    supabase.from('properties').select('*').eq('org_id', id).is('deleted_at', null).order('name'),
    supabase.from('activities').select('*').eq('org_id', id).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('record_type', 'organization').eq('record_id', id).order('created_at', { ascending: false }),
  ])

  const contacts = contactsRes.data
  const properties = propertiesRes.data
  const activities = activitiesRes.data
  const documents = documentsRes.data

  const activityUserIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))]
  const { data: activityProfiles } = activityUserIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', activityUserIds)
    : { data: [] }
  const nameMap = new Map((activityProfiles || []).map(p => [p.id, p.full_name]))

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800', medium_high: 'bg-orange-100 text-orange-800',
    medium: 'bg-blue-100 text-blue-800', low: 'bg-gray-100 text-gray-600',
  }
  const activityIcons: Record<string, string> = {
    call: '📞', email: '✉️', meeting: '🤝', note: '📝', linkedin: '💼',
    text: '💬', site_visit: '🏗️', other: '📋',
  }

  return (
    <div>
      <SetPageContext context={{ type: "organization", id, name: org.name }} />
      <Link href="/organizations" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Organizations
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">{org.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {(org.verticals?.length ? org.verticals : [org.vertical]).map((v: string) => (
              <span key={v} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(v)}`}>
                {formatVerticalLabel(v)}
              </span>
            ))}
            {org.org_role && (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {getOrgRoleLabel(org.org_role)}
              </span>
            )}
            {org.priority_rating && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[org.priority_rating]}`}>
                {org.priority_rating.replace('_', '-').toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/organizations/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-one70-border rounded-md text-sm font-medium hover:bg-one70-gray transition-colors"
          >
            <Pencil size={16} /> Edit
          </Link>
          <AdminDeleteButton table="organizations" recordId={id} recordLabel="this organization" redirectTo="/organizations" />
        </div>
      </div>

      <MobileSectionNav sections={[
        { id: 'org-details', label: 'Details' },
        { id: 'org-contacts', label: 'Contacts' },
        { id: 'org-properties', label: 'Properties' },
        { id: 'org-activity', label: 'Activity' },
        { id: 'org-tools', label: 'Tools' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <div id="org-details" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {org.hq_city && <div><span className="text-one70-mid">Location:</span> <span className="ml-1">{org.hq_city}, {org.hq_state}</span></div>}
              {org.portfolio_size && <div><span className="text-one70-mid">Portfolio:</span> <span className="ml-1">{org.portfolio_size} properties</span></div>}
              {org.annual_spend && <div><span className="text-one70-mid">Annual Spend:</span> <span className="ml-1">{org.annual_spend}</span></div>}
              {org.phone && <div><span className="text-one70-mid">Phone:</span> <span className="ml-1">{org.phone}</span></div>}
              {org.website && <div><span className="text-one70-mid">Website:</span> <a href={org.website} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">{org.website}</a></div>}
              {org.linkedin_url && <div><span className="text-one70-mid">LinkedIn:</span> <a href={org.linkedin_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">{org.linkedin_url.replace('https://www.linkedin.com/', '').replace('https://linkedin.com/', '')}</a></div>}
              {org.source && <div><span className="text-one70-mid">Source:</span> <span className="ml-1">{org.source}</span></div>}
            </div>
            {org.notes && <p className="mt-3 text-sm text-one70-dark border-t border-one70-border pt-3 whitespace-pre-wrap">{org.notes}</p>}
          </div>

          {/* Contacts */}
          <div id="org-contacts" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider">Contacts ({contacts?.length ?? 0})</h2>
              <Link href={`/contacts/new?org_id=${id}`} className="text-sm font-medium text-one70-black hover:underline">+ Add Contact</Link>
            </div>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="p-3 rounded-md hover:bg-one70-gray transition-colors">
                    <div className="flex items-start justify-between">
                      <Link href={`/contacts/${c.id}`}>
                        <p className="text-sm font-medium text-one70-black hover:underline">
                          {c.first_name} {c.last_name}
                          {c.is_decision_maker && <span className="ml-2 text-xs bg-one70-yellow text-one70-black px-1.5 py-0.5 rounded">DM</span>}
                        </p>
                        <p className="text-xs text-one70-mid">{c.title}</p>
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {c.phone && <ClickToCall value={c.phone} contactId={c.id} orgId={id} contactName={`${c.first_name} ${c.last_name}`} />}
                      {c.phone && <ClickToText value={c.phone} contactId={c.id} orgId={id} contactName={`${c.first_name} ${c.last_name}`} />}
                      {c.email && <ClickToEmail value={c.email} contactId={c.id} orgId={id} contactName={`${c.first_name} ${c.last_name}`} />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-one70-mid py-4 text-center">No contacts yet</p>
            )}
          </div>

          {/* Properties */}
          <div id="org-properties" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider">Properties ({properties?.length ?? 0})</h2>
              <Link href={`/properties/new?org_id=${id}`} className="text-sm font-medium text-one70-black hover:underline">+ Add Property</Link>
            </div>
            {properties && properties.length > 0 ? (
              <div className="space-y-2">
                {properties.map(p => (
                  <Link key={p.id} href={`/properties/${p.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-one70-gray transition-colors">
                    <div>
                      <p className="text-sm font-medium text-one70-black">{p.name}</p>
                      <p className="text-xs text-one70-mid">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                    </div>
                    <div className="text-xs text-one70-mid">
                      {p.key_count ? `${p.key_count} keys` : p.unit_count ? `${p.unit_count} units` : p.bed_count ? `${p.bed_count} beds` : ''}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-one70-mid py-4 text-center">No properties yet</p>
            )}
          </div>

          {/* Documents */}
          <Documents recordType="organization" recordId={id} documents={documents || []} />
        </div>

        {/* Right column: AI tools + Activity feed */}
        <div className="space-y-4">
          <div id="org-tools" className="bg-white rounded-lg border border-one70-border p-5 space-y-3 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-1">AI Tools</h2>
            <AiDraft orgId={id} />
            <MeetingPrep orgId={id} />
            <NoteProcessor orgId={id} />
          </div>

          <div id="org-activity" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Activity</h2>
            <AddActivityForm orgId={id} />
            <div className="mt-4 space-y-3">
              {activities && activities.length > 0 ? (
                activities.map(a => (
                  <div key={a.id} className="border-l-2 border-one70-border pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span>{activityIcons[a.type] || '📋'}</span>
                      <span className="text-xs font-medium text-one70-dark capitalize">{a.type}</span>
                      <span className="text-xs text-one70-mid">
                        {new Date(a.occurred_at).toLocaleDateString()}
                      </span>
                    </div>
                    {a.subject && <p className="text-sm font-medium text-one70-black mt-0.5">{a.subject}</p>}
                    {a.body && <p className="text-xs text-one70-mid mt-0.5 line-clamp-2">{a.body}</p>}
                    <p className="text-xs text-one70-mid mt-0.5">by {nameMap.get(a.user_id) || 'Unknown'}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-one70-mid py-4 text-center">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
