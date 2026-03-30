import SetPageContext from "@/components/set-page-context"
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import AddActivityForm from '@/components/add-activity-form'
import AddTaskForm from '@/components/add-task-form'
import KeyNotes from '@/components/key-notes'
import { ClickToCall, ClickToEmail, ClickToText } from '@/components/click-actions'
import CopyEmailButton from '@/components/copy-email-button'
import AiDraft from '@/components/ai-draft'
import MeetingPrep from '@/components/ai-meeting-prep'
import NoteProcessor from '@/components/ai-note-processor'
import Documents from '@/components/documents'
import EnrollInSequence from '@/components/enroll-sequence'
import AdminDeleteButton from '@/components/admin-delete'
import MobileSectionNav from '@/components/mobile-section-nav'
import ContactTimeline from '@/components/contact-timeline'
import SaveToPhone from '@/components/save-to-phone'
import { getContactTypeColor, getContactTypeLabel } from '@/lib/contact-types'
import ComposeEmail from '@/components/compose-email'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*, organizations(id, name, vertical)')
    .eq('id', id)
    .single()

  if (!contact) notFound()

  // Parallelize all remaining queries
  const [activitiesRes, keyNotesRes, tasksRes, referralsRes, documentsRes, referrerRes] = await Promise.all([
    supabase.from('activities').select('*').eq('contact_id', id).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('key_notes').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('contact_id', id).eq('status', 'pending').order('due_date', { ascending: true }),
    supabase.from('contacts').select('id, first_name, last_name, title').is('deleted_at', null).eq('referred_by', id),
    supabase.from('documents').select('*').eq('record_type', 'contact').eq('record_id', id).order('created_at', { ascending: false }),
    contact.referred_by
      ? supabase.from('contacts').select('id, first_name, last_name').eq('id', contact.referred_by).single()
      : Promise.resolve({ data: null }),
  ])

  // Additional orgs - separate query with error handling for tables that may not exist
  let additionalOrgsData: any[] = []
  try {
    const { data, error } = await supabase.from('contact_organizations')
      .select('org_id, role, is_primary, organizations:org_id(id, name)')
      .eq('contact_id', id)
    if (!error && data) additionalOrgsData = data
  } catch {}

  const activities = activitiesRes.data
  const keyNotes = keyNotesRes.data
  const tasks = tasksRes.data
  const referrals = referralsRes.data
  const documents = documentsRes.data
  const referrer = referrerRes.data
  const additionalOrgs = additionalOrgsData.filter((ao: any) => ao.org_id !== contact.org_id)

  // Build name lookups in parallel
  const allUserIds = [...new Set([
    ...(activities || []).map(a => a.user_id),
    ...(documents || []).map(d => d.uploaded_by),
  ].filter(Boolean))]
  const { data: allProfiles } = allUserIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', allUserIds)
    : { data: [] }
  const nameMap = new Map((allProfiles || []).map(p => [p.id, p.full_name]))
  const docNameMap = nameMap

  const activityIcons: Record<string, string> = {
    call: '📞', email: '✉️', meeting: '🤝', note: '📝', linkedin: '💼',
    text: '💬', site_visit: '🏗️', other: '📋',
  }

  const contactName = `${contact.first_name} ${contact.last_name}`

  return (
    <div>
      <SetPageContext context={{ type: "contact", id, name: contactName }} />
      <Link href="/contacts" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Contacts
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-4">
          {/* Contact avatar */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-one70-gray flex items-center justify-center overflow-hidden shrink-0 border-2 border-one70-border">
            {contact.avatar_url ? (
              <img src={contact.avatar_url} alt={contactName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl sm:text-2xl font-bold text-one70-mid">
                {contact.first_name?.[0]}{contact.last_name?.[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-one70-black">
              {contactName}
              {contact.contact_type && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded align-middle ${getContactTypeColor(contact.contact_type)}`}>{getContactTypeLabel(contact.contact_type)}</span>
              )}
              {contact.rating && contact.rating !== 'cold' && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded align-middle ${
                  contact.rating === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>{contact.rating === 'active' ? '⚡ Active' : '🔥 Warm'}</span>
              )}
              {contact.is_decision_maker && (
                <span className="ml-2 text-xs sm:text-sm bg-one70-yellow text-one70-black px-2 py-0.5 sm:py-1 rounded align-middle">DM</span>
              )}
              {contact.is_referrer && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded align-middle">Referrer</span>
            )}
          </h1>
          {contact.title && <p className="text-one70-mid mt-1">{contact.title}</p>}
          {contact.organizations && (
            <Link href={`/organizations/${(contact.organizations as any).id}`} className="text-sm text-blue-600 hover:underline mt-1 inline-block">
              {(contact.organizations as any).name}
            </Link>
          )}
          {additionalOrgs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {additionalOrgs.map((ao: any) => (
                <Link key={ao.org_id} href={`/organizations/${(ao.organizations as any)?.id || ao.org_id}`}
                  className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded">
                  {(ao.organizations as any)?.name}{ao.role ? ` (${ao.role})` : ''}
                </Link>
              ))}
            </div>
          )}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveToPhone
            firstName={contact.first_name} lastName={contact.last_name}
            email={contact.email} phone={contact.phone} title={contact.title}
            company={(contact.organizations as any)?.name}
            linkedinUrl={contact.linkedin_url}
          />
          <Link
            href={`/contacts/${id}/edit`}
            className="flex items-center gap-2 px-3 py-1.5 border border-one70-border rounded-md text-xs font-medium hover:bg-one70-gray transition-colors"
          >
            <Pencil size={14} /> Edit
          </Link>
          <AdminDeleteButton table="contacts" recordId={id} recordLabel="this contact" redirectTo="/contacts" />
        </div>
      </div>

      {/* Quick action bar — one-tap call, email, text */}
      <div className="flex flex-wrap gap-2 mb-6">
        {contact.mobile_phone && (
          <a href={`tel:${contact.mobile_phone}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all">
            📱 Call Mobile
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all">
            📞 Call Office
          </a>
        )}
        {contact.email && (
          <CopyEmailButton email={contact.email} />
        )}
        {contact.mobile_phone && (
          <a href={`sms:${contact.mobile_phone}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all">
            💬 Text
          </a>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all">
            💼 LinkedIn
          </a>
        )}
      </div>

      {/* Compose email */}
      {contact.email && (
        <div className="mb-6">
          <ComposeEmail
            defaultTo={contact.email}
            contactId={id}
            orgId={contact.org_id}
            contactName={contact.first_name}
          />
        </div>
      )}

      {/* Mobile section navigator */}
      <MobileSectionNav sections={[
        { id: 'contact-info', label: 'Info' },
        { id: 'contact-tasks', label: 'Tasks' },
        { id: 'contact-notes', label: 'Notes' },
        { id: 'contact-activity', label: 'Activity' },
        { id: 'contact-tools', label: 'Tools' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info with action buttons */}
          <div id="contact-info" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {contact.email && (
                <div>
                  <span className="text-one70-mid">Email:</span>
                  <span className="ml-1 text-one70-dark">{contact.email}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ClickToEmail value={contact.email} contactId={id} orgId={contact.org_id} contactName={contactName} />
                  </div>
                </div>
              )}
              {contact.phone && (
                <div>
                  <span className="text-one70-mid">Office:</span>
                  <span className="ml-1 text-one70-dark">{contact.phone}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ClickToCall value={contact.phone} contactId={id} orgId={contact.org_id} contactName={contactName} />
                    <ClickToText value={contact.phone} contactId={id} orgId={contact.org_id} contactName={contactName} />
                  </div>
                </div>
              )}
              {contact.mobile_phone && (
                <div>
                  <span className="text-one70-mid">Mobile:</span>
                  <span className="ml-1 text-one70-dark">{contact.mobile_phone}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ClickToCall value={contact.mobile_phone} contactId={id} orgId={contact.org_id} contactName={contactName} />
                    <ClickToText value={contact.mobile_phone} contactId={id} orgId={contact.org_id} contactName={contactName} />
                  </div>
                </div>
              )}
              {contact.linkedin_url && (
                <div><span className="text-one70-mid">LinkedIn:</span> <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">View Profile</a></div>
              )}
              {contact.preferred_channel && (
                <div><span className="text-one70-mid">Preferred Channel:</span> <span className="ml-1 capitalize">{contact.preferred_channel}</span></div>
              )}
            </div>
            {contact.notes && <p className="mt-3 text-sm text-one70-dark border-t border-one70-border pt-3 whitespace-pre-wrap">{contact.notes}</p>}
          </div>

          {/* Referral info */}
          {(referrer || (referrals && referrals.length > 0)) && (
            <div className="bg-white rounded-lg border border-one70-border p-5">
              <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Referrals</h2>
              {referrer && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500">Referred by: </span>
                  <Link href={`/contacts/${referrer.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {referrer.first_name} {referrer.last_name}
                  </Link>
                </div>
              )}
              {referrals && referrals.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Has referred {referrals.length} contact{referrals.length > 1 ? 's' : ''}:</span>
                  <div className="mt-1 space-y-1">
                    {referrals.map((r: any) => (
                      <Link key={r.id} href={`/contacts/${r.id}`} className="block text-sm text-blue-600 hover:underline">
                        {r.first_name} {r.last_name}{r.title ? ` — ${r.title}` : ''}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {contact.referral_notes && <p className="mt-2 text-xs text-gray-500">{contact.referral_notes}</p>}
            </div>
          )}

          {/* Tasks */}
          <div id="contact-tasks" className="scroll-mt-24">
          {tasks && tasks.length > 0 && (
            <div className="bg-white rounded-lg border border-one70-border p-5">
              <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Pending Tasks</h2>
              <div className="space-y-2">
                {tasks.map((t: any) => (
                  <div key={t.id} className={`p-2 rounded-md text-sm ${t.priority === 'high' ? 'bg-red-50' : 'bg-one70-gray'}`}>
                    <p className="font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.type.replace('_', ' ')} {t.due_date && `— Due ${new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          {/* Key notes */}
          <div id="contact-notes" className="scroll-mt-24">
          <KeyNotes contactId={id} notes={keyNotes || []} />

          {/* Documents */}
          <Documents recordType="contact" recordId={id} documents={documents || []} uploaderNames={docNameMap} />
          </div>
        </div>

        {/* Right column: AI tools + Activity feed */}
        <div className="space-y-4">
          {/* AI Tools */}
          <div id="contact-tools" className="bg-white rounded-lg border border-one70-border p-5 space-y-3 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-1">AI Tools</h2>
            <AiDraft contactId={id} orgId={contact.org_id} />
            <MeetingPrep contactId={id} orgId={contact.org_id} />
            <NoteProcessor contactId={id} orgId={contact.org_id} />
          </div>

          {/* Sequence Enrollment */}
          <EnrollInSequence contactId={id} />

          <div className="bg-white rounded-lg border border-one70-border p-5">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Quick Log</h2>
            <AddActivityForm contactId={id} orgId={contact.org_id} />
            <AddTaskForm contactId={id} orgId={contact.org_id} compact />
          </div>

          {/* Full timeline - all interactions */}
          <div id="contact-activity" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <ContactTimeline contactId={id} orgId={contact.org_id} />
          </div>
        </div>
      </div>
    </div>
  )
}
