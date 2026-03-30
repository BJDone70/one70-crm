import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import TaskUpdates from './task-updates'
import TaskActions from './task-actions'
import InlineSubtaskForm from '@/components/inline-subtask-form'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, contacts(id, first_name, last_name), organizations(id, name), deals(id, name)')
    .eq('id', id)
    .single()

  if (!task) notFound()

  const [updatesRes, repsRes, subtasksRes, parentRes] = await Promise.all([
    supabase.from('task_updates').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('tasks').select('id, title, status, priority, type, due_date, assigned_to').eq('parent_task_id', id).order('created_at'),
    task.parent_task_id ? supabase.from('tasks').select('id, title').eq('id', task.parent_task_id).single() : Promise.resolve({ data: null }),
  ])

  // Map profile names into updates
  const repsData = repsRes.data || []
  const nameMap: Record<string, string> = {}
  repsData.forEach(r => { nameMap[r.id] = r.full_name })
  const updatesWithNames = (updatesRes.data || []).map(u => ({
    ...u,
    profiles: { full_name: nameMap[u.user_id] || 'User' },
  }))

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-red-100 text-red-700',
  }
  const typeLabels: Record<string, string> = {
    follow_up: 'Follow-up', call: 'Call', meeting: 'Meeting',
    site_visit: 'Site Visit', proposal: 'Proposal', other: 'Other',
  }
  const assignedName = repsData.find(r => r.id === task.assigned_to)?.full_name || 'Unassigned'

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/tasks" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark">
          <ArrowLeft size={16} /> Back to Tasks
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/tasks/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-one70-border text-one70-dark rounded-md text-sm font-semibold hover:bg-one70-gray active:scale-95 transition-all">
            <Pencil size={14} /> Edit
          </Link>
        </div>
      </div>

      {/* Quick complete bar - always visible at top */}
      <TaskActions
        taskId={id}
        taskTitle={task.title}
        currentStatus={task.status}
        currentAssignee={task.assigned_to}
        contactId={task.contact_id}
        orgId={task.org_id}
        dealId={task.deal_id}
        linkedName={[
          task.contacts ? `${task.contacts.first_name} ${task.contacts.last_name}` : '',
          task.organizations?.name || '',
          task.deals?.name ? `Deal: ${task.deals.name}` : '',
        ].filter(Boolean).join(' • ')}
        reps={repsData.map(r => ({ id: r.id, name: r.full_name }))}
        userId={user?.id || ''}
      />

      {/* Task detail card */}
      <div className="bg-white rounded-lg border border-one70-border p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-one70-black">{task.title}</h1>
            {task.description && <p className="text-sm text-one70-dark mt-1">{task.description}</p>}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {task.status === 'completed' ? 'Done' : 'Pending'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Type</p>
            <p className="text-one70-dark mt-0.5">{typeLabels[task.type] || task.type}</p>
          </div>
          <div>
            <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Priority</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${priorityColors[task.priority] || ''}`}>{task.priority}</span>
          </div>
          <div>
            <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Due Date</p>
            <p className={`text-one70-dark mt-0.5 ${task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 font-semibold' : ''}`}>
              {task.due_date || 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Assigned To</p>
            <p className="text-one70-dark mt-0.5">{assignedName}</p>
          </div>
          {task.contacts && (
            <div>
              <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Contact</p>
              <Link href={`/contacts/${task.contacts.id}`} className="text-blue-600 hover:underline mt-0.5 block">
                {task.contacts.first_name} {task.contacts.last_name}
              </Link>
            </div>
          )}
          {task.organizations && (
            <div>
              <p className="text-xs text-one70-mid font-medium uppercase tracking-wide">Organization</p>
              <Link href={`/organizations/${task.organizations.id}`} className="text-blue-600 hover:underline mt-0.5 block">
                {task.organizations.name}
              </Link>
            </div>
          )}
        </div>

        {task.completed_at && (
          <p className="text-xs text-green-600 mt-4 pt-3 border-t border-one70-border">
            Completed on {new Date(task.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Parent task link */}
      {parentRes.data && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 px-4 py-2.5 mb-4 text-sm">
          <span className="text-blue-600">Sub-task of: </span>
          <Link href={`/tasks/${parentRes.data.id}`} className="text-blue-700 font-medium hover:underline">{parentRes.data.title}</Link>
        </div>
      )}

      {/* Subtasks */}
      {((subtasksRes.data || []).length > 0 || task.status !== 'completed') && (
        <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
          <h3 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Sub-tasks</h3>
          {(subtasksRes.data || []).length > 0 ? (
            <div className="space-y-2 mb-3">
              {(subtasksRes.data || []).map((st: any) => (
                <Link key={st.id} href={`/tasks/${st.id}`} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-one70-gray transition-colors">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${st.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                    {st.status === 'completed' && <span className="text-xs">✓</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${st.status === 'completed' ? 'text-gray-400 line-through' : 'text-one70-dark'}`}>{st.title}</p>
                    <p className="text-[10px] text-one70-mid">
                      {typeLabels[st.type] || st.type} · {st.priority}
                      {st.due_date && ` · Due ${new Date(st.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      {st.assigned_to && nameMap[st.assigned_to] && ` · ${nameMap[st.assigned_to]}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-3">No sub-tasks yet.</p>
          )}
          <InlineSubtaskForm
            parentTaskId={id}
            contactId={task.contact_id}
            orgId={task.org_id}
            dealId={task.deal_id}
            reps={repsData.map(r => ({ id: r.id, name: r.full_name }))}
            userId={user?.id || ''}
          />
        </div>
      )}

      {/* Updates / Steps log */}
      <TaskUpdates taskId={id} initialUpdates={updatesWithNames} userId={user?.id || ''} />
    </div>
  )
}
