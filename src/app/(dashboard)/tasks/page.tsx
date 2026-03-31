import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TasksList from './tasks-list'
import { todayInTimezone } from '@/lib/timezone'

interface SearchParams {
  status?: string
  type?: string
  assignee?: string
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const status = params.status || 'pending'
  const type = params.type || 'all'
  const assignee = params.assignee || 'mine'

  // Build query - show all tasks visible to user
  let query = supabase
    .from('tasks')
    .select('*, contacts(id, first_name, last_name), organizations(id, name), deals(id, name), parent_task_id')
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })

  // Filter by assignee (supports comma-separated IDs for multi-select)
  if (assignee === 'mine') {
    query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
  } else if (assignee !== 'all') {
    const ids = assignee.split(',').filter(Boolean)
    if (ids.length === 1) {
      query = query.or(`assigned_to.eq.${ids[0]},assigned_to.is.null`)
    } else {
      query = query.or(`assigned_to.in.(${ids.join(',')}),assigned_to.is.null`)
    }
  }
  // For 'all': fetch everything, then filter private in JS

  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (type !== 'all') {
    query = query.eq('type', type)
  }

  const { data: rawTasks } = await query

  // Filter out private tasks that belong to other users
  const tasks = (rawTasks || []).filter(t =>
    !t.is_private || t.assigned_to === user.id || t.created_by === user.id
  )

  const { data: tzProf } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const today = todayInTimezone(tzProf?.timezone || 'America/New_York')
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Parallelize remaining queries
  const [remindersRes, pendingRes, completedRes, repsRes, profileRes] = await Promise.all([
    supabase.from('key_notes').select('*, contacts(id, first_name, last_name)').not('reminder_date', 'is', null).gte('reminder_date', today).lte('reminder_date', thirtyDays).order('reminder_date'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).is('deleted_at', null).or(`assigned_to.eq.${user.id},assigned_to.is.null`).eq('status', 'pending'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).is('deleted_at', null).or(`assigned_to.eq.${user.id},assigned_to.is.null`).eq('status', 'completed'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const reminders = remindersRes.data || []
  const pendingCount = pendingRes.count || 0
  const completedCount = completedRes.count || 0
  const reps = repsRes.data || []
  const profile = profileRes.data

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Tasks & Follow-ups</h1>
          <p className="text-sm text-one70-mid mt-1">Manage tasks, reminders, and follow-ups</p>
        </div>
        <Link href="/tasks/new"
          className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
          <Plus size={18} /> New Task
        </Link>
      </div>

      <TasksList
        tasks={tasks}
        reminders={reminders || []}
        currentStatus={status}
        currentType={type}
        currentAssignee={assignee}
        pendingCount={pendingCount || 0}
        completedCount={completedCount || 0}
        reps={reps || []}
        currentUserId={user.id}
        isAdmin={profile?.role === 'admin'}
      />
    </div>
  )
}
