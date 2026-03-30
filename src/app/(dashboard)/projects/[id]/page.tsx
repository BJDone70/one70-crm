import SetPageContext from "@/components/set-page-context"
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, DollarSign, Calendar, User, FileText, Pencil } from 'lucide-react'
import Documents from '@/components/documents'
import AddActivityForm from '@/components/add-activity-form'
import ProjectStatusChanger from './project-status'
import AdminDeleteButton from '@/components/admin-delete'
import { getStageLabel, getStageColor, DEFAULT_PROJECT_STAGES, ProjectStage } from '@/lib/project-stages'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'
const projectTypeLabels: Record<string, string> = { major_construction: 'Major Construction', renovation: 'Renovation' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*, organizations(id, name), properties(id, name, city, state), contacts(id, first_name, last_name), deals(id, name)')
    .eq('id', id)
    .single()

  if (!project) notFound()

  // Load custom project stages from DB
  let stages: ProjectStage[] = DEFAULT_PROJECT_STAGES
  try {
    const { data: stageData } = await supabase.from('project_stages').select('*').order('sort_order')
    if (stageData?.length) {
      stages = stageData.map((s: any) => ({ id: s.name, label: s.label, color: s.color || 'bg-gray-100 text-gray-600', sort_order: s.sort_order, is_terminal: s.is_terminal }))
    }
  } catch {}

  // Parallelize all remaining queries
  const [repRes, activitiesRes, repsRes, docsRes] = await Promise.all([
    project.assigned_to
      ? supabase.from('profiles').select('full_name').eq('id', project.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase.from('activities').select('*').eq('org_id', project.org_id).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
    supabase.from('documents').select('*').eq('record_type', 'project').eq('record_id', id).order('created_at', { ascending: false }),
  ])

  const repName = repRes.data?.full_name || null
  const activities = activitiesRes.data
  const nameMap = Object.fromEntries((repsRes.data || []).map(r => [r.id, r.full_name]))
  const projectDocs = docsRes.data

  const docUploaderIds = [...new Set((projectDocs || []).map(d => d.uploaded_by).filter(Boolean))]
  const docNameMap = new Map((repsRes.data || []).filter(p => docUploaderIds.includes(p.id)).map(p => [p.id, p.full_name]))

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div>
      <SetPageContext context={{ type: "project", id, name: project.name }} />
      <Link href="/projects" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStageColor(project.status, stages)}`}>
              {getStageLabel(project.status, stages)}
            </span>
            <span className="text-xs text-gray-500">{(project.verticals?.length ? project.verticals : [project.vertical]).map((v: string) => formatVerticalLabel(v)).join(', ')}</span>
            {project.project_type && (
              <span className="text-xs text-gray-500">{projectTypeLabels[project.project_type] || project.project_type}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Link href={`/projects/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 border border-one70-border rounded-md text-sm font-medium hover:bg-one70-gray transition-colors">
              <Pencil size={14} /> Edit
            </Link>
            <AdminDeleteButton table="projects" recordId={project.id} recordLabel="this project" redirectTo="/projects" />
          </div>
          <ProjectStatusChanger projectId={project.id} currentStatus={project.status} projectName={project.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details card */}
          <div className="bg-white rounded-lg border border-one70-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-one70-dark mb-3">Project Details</h2>
            {project.organizations && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-gray-400" />
                <Link href={`/organizations/${project.organizations.id}`} className="text-blue-600 hover:underline">{project.organizations.name}</Link>
              </div>
            )}
            {project.properties && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-gray-400" />
                <Link href={`/properties/${project.properties.id}`} className="text-blue-600 hover:underline">
                  {project.properties.name}{project.properties.city ? `, ${project.properties.city}` : ''}{project.properties.state ? `, ${project.properties.state}` : ''}
                </Link>
              </div>
            )}
            {project.contract_value && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign size={14} className="text-gray-400" />
                <span className="font-semibold">{formatCurrency(Number(project.contract_value))}</span>
              </div>
            )}
            {project.percent_complete != null && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex-1 max-w-xs bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${project.percent_complete === 100 ? 'bg-green-500' : 'bg-one70-black'}`}
                    style={{ width: `${project.percent_complete}%` }} />
                </div>
                <span className="text-sm font-semibold text-one70-dark">{project.percent_complete}% complete</span>
              </div>
            )}
            {repName && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-gray-400" /> {repName}
              </div>
            )}
            {project.deals && (
              <div className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-gray-400" />
                <span className="text-gray-500">From deal:</span>
                <Link href={`/deals/${project.deals.id}`} className="text-blue-600 hover:underline">{project.deals.name}</Link>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-one70-border">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Start Date</p>
                <p className="text-sm font-medium">{project.start_date || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Target End</p>
                <p className="text-sm font-medium">{project.target_end_date || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Actual End</p>
                <p className="text-sm font-medium">{project.actual_end_date || '—'}</p>
              </div>
            </div>
            {project.scope_description && (
              <div className="pt-3 border-t border-one70-border">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Scope</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.scope_description}</p>
              </div>
            )}
            {project.notes && (
              <div className="pt-3 border-t border-one70-border">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p>
              </div>
            )}
          </div>

          {/* Documents */}
          <Documents recordType="project" recordId={project.id} documents={projectDocs || []} uploaderNames={docNameMap} />

          {/* Activities */}
          <div className="bg-white rounded-lg border border-one70-border p-5">
            <h2 className="text-sm font-semibold text-one70-dark mb-4">Activities</h2>
            <AddActivityForm contactId={project.contact_id} orgId={project.org_id} dealId={project.deal_id} />
            {activities && activities.length > 0 ? (
              <div className="mt-4 space-y-2">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-one70-border last:border-0">
                    <span className="text-[10px] font-bold text-white bg-one70-black px-1.5 py-0.5 rounded uppercase shrink-0">{a.type}</span>
                    <div className="flex-1 min-w-0">
                      {a.subject && <p className="text-sm font-medium text-gray-900">{a.subject}</p>}
                      {a.body && <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(a.occurred_at).toLocaleString()} · {nameMap[a.user_id] || 'Unknown'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-4">No activities logged yet</p>
            )}
          </div>
        </div>

        {/* Sidebar with timeline */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-one70-border p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Timeline</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-500">Created</span>
                <span className="ml-auto text-gray-400">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              {project.start_date && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-500">Started</span>
                  <span className="ml-auto text-gray-400">{project.start_date}</span>
                </div>
              )}
              {project.actual_end_date && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600" />
                  <span className="text-gray-500">Completed</span>
                  <span className="ml-auto text-gray-400">{project.actual_end_date}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
