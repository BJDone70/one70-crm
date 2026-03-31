import SetPageContext from "@/components/set-page-context"
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, DollarSign, Calendar, User, Building2 } from 'lucide-react'
import AddActivityForm from '@/components/add-activity-form'
import AddTaskForm from '@/components/add-task-form'
import DealStageChanger from './stage-changer'
import ConvertToProject from './convert-to-project'
import AiDraft from '@/components/ai-draft'
import MeetingPrep from '@/components/ai-meeting-prep'
import NoteProcessor from '@/components/ai-note-processor'
import DealCoach from '@/components/ai-deal-coach'
import DealVelocity from '@/components/deal-velocity'
import Documents from '@/components/documents'
import DealDeleteButton from '@/components/deal-delete-button'
import MobileSectionNav from '@/components/mobile-section-nav'
import { PIPELINE_STAGES, WON_STAGE, LOST_STAGE } from '@/lib/stages'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'
import { formatInTimezone } from '@/lib/timezone'

const STAGES = PIPELINE_STAGES

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('*, organizations(id, name), contacts(id, first_name, last_name), properties(id, name)')
    .eq('id', id)
    .single()

  if (!deal) notFound()

  // Get current user's role
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = user
    ? await supabase.from('profiles').select('role, timezone').eq('id', user.id).single()
    : { data: null }
  const isAdmin = userProfile?.role === 'admin'
  const userTz = userProfile?.timezone || 'America/New_York'

  // Parallelize all remaining queries
  const [repRes, activitiesRes, tasksRes, documentsRes, projectRes] = await Promise.all([
    deal.assigned_to
      ? supabase.from('profiles').select('full_name').eq('id', deal.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase.from('activities').select('*').eq('deal_id', id).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('tasks').select('*').eq('deal_id', id).eq('status', 'pending').order('due_date', { ascending: true }),
    supabase.from('documents').select('*').eq('record_type', 'deal').eq('record_id', id).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, status').eq('deal_id', id).is('deleted_at', null).single(),
  ])

  const repName = repRes.data?.full_name || null
  const activities = activitiesRes.data
  const tasks = tasksRes.data
  const documents = documentsRes.data
  const existingProject = projectRes.data

  // Check if a build project exists for this CRM project
  let buildProjectExists = false
  if (existingProject) {
    const { data: bp } = await supabase.from('build_projects').select('id').eq('crm_project_id', existingProject.id).is('deleted_at', null).single()
    buildProjectExists = !!bp
  }

  // Name lookup
  const activityUserIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))]
  const { data: activityProfiles } = activityUserIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', activityUserIds)
    : { data: [] }
  const nameMap = new Map((activityProfiles || []).map(p => [p.id, p.full_name]))

  const activityIcons: Record<string, string> = {
    call: '📞', email: '✉️', meeting: '🤝', note: '📝', linkedin: '💼',
    text: '💬', site_visit: '🏗️', other: '📋',
  }

  const currentStageIndex = STAGES.findIndex(s => s.id === deal.stage)

  return (
    <div>
      <SetPageContext context={{ type: "deal", id, name: deal.name }} />
      <Link href="/deals" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Pipeline
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-one70-black">{deal.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {(deal.verticals?.length ? deal.verticals : [deal.vertical]).map((v: string) => (
              <span key={v} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(v)}`}>
                {formatVerticalLabel(v)}
              </span>
            ))}
            {deal.value && (
              <span className="flex items-center gap-0.5 text-sm font-semibold text-gray-700">
                <DollarSign size={14} />{Number(deal.value).toLocaleString()}
              </span>
            )}
            {repName && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <User size={12} /> {repName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/deals/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-one70-border rounded-md text-sm font-medium hover:bg-one70-gray transition-colors"
          >
            <Pencil size={16} /> Edit
          </Link>
          {isAdmin && <DealDeleteButton dealId={id} dealName={deal.name} />}
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="bg-white rounded-lg border border-one70-border p-4 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STAGES.filter(s => s.id !== LOST_STAGE).map((stage, i) => {
            const isActive = stage.id === deal.stage
            const isPast = i < currentStageIndex && deal.stage !== LOST_STAGE
            const isWon = stage.id === WON_STAGE && deal.stage === WON_STAGE
            const isLost = deal.stage === LOST_STAGE

            return (
              <div key={stage.id} className="flex items-center flex-1 min-w-0">
                <div className={`flex-1 py-2 px-2 text-center text-xs font-medium rounded transition-colors ${
                  isWon ? 'bg-green-500 text-white' :
                  isLost ? 'bg-gray-200 text-gray-400' :
                  isActive ? 'bg-one70-yellow text-one70-black' :
                  isPast ? 'bg-one70-black text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  <span className="hidden sm:inline">{stage.label}</span>
                  <span className="sm:hidden">{stage.label.substring(0, 3)}</span>
                </div>
                {i < STAGES.length - 2 && (
                  <div className={`w-2 h-0.5 shrink-0 ${isPast ? 'bg-one70-black' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
        {deal.stage === LOST_STAGE && (
          <div className="mt-2 text-center">
            <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              LOST / NO-GO{deal.loss_reason ? ` — ${deal.loss_reason}` : ''}
            </span>
          </div>
        )}
        <div className="mt-3">
          <DealStageChanger dealId={id} currentStage={deal.stage} />
        </div>
        {deal.stage === WON_STAGE && (
          <div className="mt-3 pt-3 border-t border-one70-border">
            <ConvertToProject dealId={id} existingProject={existingProject} buildProjectExists={buildProjectExists} />
          </div>
        )}
      </div>

      <MobileSectionNav sections={[
        { id: 'deal-details', label: 'Details' },
        { id: 'deal-tasks', label: 'Tasks' },
        { id: 'deal-docs', label: 'Docs' },
        { id: 'deal-activity', label: 'Activity' },
        { id: 'deal-tools', label: 'Tools' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal details */}
          <div id="deal-details" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Deal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {deal.organizations && (
                <div>
                  <span className="text-one70-mid">Organization:</span>
                  <Link href={`/organizations/${(deal.organizations as any).id}`} className="ml-1 text-blue-600 hover:underline">
                    {(deal.organizations as any).name}
                  </Link>
                </div>
              )}
              {deal.contacts && (
                <div>
                  <span className="text-one70-mid">Contact:</span>
                  <Link href={`/contacts/${deal.contact_id}`} className="ml-1 text-blue-600 hover:underline">
                    {(deal.contacts as any).first_name} {(deal.contacts as any).last_name}
                  </Link>
                </div>
              )}
              {deal.properties && (
                <div>
                  <span className="text-one70-mid">Property:</span>
                  <Link href={`/properties/${deal.property_id}`} className="ml-1 text-blue-600 hover:underline">
                    {(deal.properties as any).name}
                  </Link>
                </div>
              )}
              {deal.expected_close && (
                <div>
                  <span className="text-one70-mid">Expected Close:</span>
                  <span className="ml-1">{new Date(deal.expected_close + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {deal.services_offered && (
                <div className="sm:col-span-2">
                  <span className="text-one70-mid">Services:</span>
                  <span className="ml-1">{deal.services_offered}</span>
                </div>
              )}
              {deal.message_theme && (
                <div className="sm:col-span-2">
                  <span className="text-one70-mid">Message Theme:</span>
                  <span className="ml-1">{deal.message_theme}</span>
                </div>
              )}
            </div>
            {deal.notes && <p className="mt-3 text-sm text-one70-dark border-t border-one70-border pt-3 whitespace-pre-wrap">{deal.notes}</p>}
          </div>

          {/* Pending tasks */}
          <div id="deal-tasks" className="scroll-mt-24">
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

          {/* Documents */}
          <div id="deal-docs" className="scroll-mt-24">
          <Documents recordType="deal" recordId={id} documents={documents || []} />
          </div>
        </div>

        {/* Right column: AI tools + Activity */}
        <div className="space-y-4">
          {/* Deal Velocity */}
          <DealVelocity dealId={id} currentStage={deal.stage} createdAt={deal.created_at} />

          {/* AI Tools */}
          <div id="deal-tools" className="bg-white rounded-lg border border-one70-border p-5 space-y-3 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-1">AI Tools</h2>
            <DealCoach dealId={id} />
            <AiDraft contactId={deal.contact_id} orgId={deal.org_id} dealId={id} />
            <MeetingPrep contactId={deal.contact_id} orgId={deal.org_id} dealId={id} />
            <NoteProcessor contactId={deal.contact_id} orgId={deal.org_id} dealId={id} />
          </div>

          <div id="deal-activity" className="bg-white rounded-lg border border-one70-border p-5 scroll-mt-24">
            <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Activity</h2>
            <AddActivityForm dealId={id} orgId={deal.org_id} contactId={deal.contact_id} />
            <AddTaskForm dealId={id} orgId={deal.org_id} contactId={deal.contact_id} compact />
            <div className="mt-4 space-y-3">
              {activities && activities.length > 0 ? (
                activities.map(a => (
                  <div key={a.id} className="border-l-2 border-one70-border pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span>{activityIcons[a.type] || '📋'}</span>
                      <span className="text-xs font-medium text-one70-dark capitalize">{a.type}</span>
                      <span className="text-xs text-one70-mid">{formatInTimezone(a.occurred_at, userTz, { dateOnly: true })}</span>
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
