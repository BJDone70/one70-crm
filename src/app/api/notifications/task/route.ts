import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTaskAssigned, notifyTaskCompleted } from '@/lib/notify'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { action, task_id, task_title, user_id, assignee_id } = await request.json()
    if (!action || !user_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single()
    const userName = profile?.full_name || 'Someone'

    if (action === 'assigned' && assignee_id && assignee_id !== user_id) {
      notifyTaskAssigned(assignee_id, task_title || 'New task', userName, task_id)
    } else if (action === 'completed' && task_id) {
      // Notify the task creator if different from completer
      const { data: task } = await supabaseAdmin.from('tasks').select('created_by, assigned_to').eq('id', task_id).single()
      if (task?.created_by && task.created_by !== user_id) {
        notifyTaskCompleted(task_title || 'Task', userName, task.created_by, task_id)
      }
      if (task?.assigned_to && task.assigned_to !== user_id && task.assigned_to !== task?.created_by) {
        notifyTaskCompleted(task_title || 'Task', userName, task.assigned_to, task_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
