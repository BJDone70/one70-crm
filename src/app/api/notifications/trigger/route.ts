export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notifyTaskAssigned,
  notifyProjectStatusChanged,
  notifySequenceActionDue,
} from '@/lib/notify'

// Fire-and-forget notification trigger from client components
// POST /api/notifications/trigger
// Body: { type: 'task_assigned' | 'project_status' | 'sequence_due', ...params }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type } = body

  // Get current user's name for notification text
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const userName = profile?.full_name || 'Someone'

  switch (type) {
    case 'task_assigned': {
      const { assigneeId, taskTitle } = body
      if (assigneeId && assigneeId !== user.id && taskTitle) {
        notifyTaskAssigned(assigneeId, taskTitle, userName)
      }
      break
    }

    case 'project_status': {
      const { projectId, projectName, newStatus } = body
      if (projectId && projectName && newStatus) {
        // Get all team members involved with this project
        const { data: project } = await supabase
          .from('projects')
          .select('assigned_to, created_by')
          .eq('id', projectId)
          .single()
        if (project) {
          const userIds = [project.assigned_to, project.created_by].filter(Boolean) as string[]
          notifyProjectStatusChanged(userIds, projectName, newStatus, user.id)
        }
      }
      break
    }

    case 'sequence_due': {
      const { userId, contactName, stepType } = body
      if (userId && contactName) {
        notifySequenceActionDue(userId, contactName, stepType || 'Outreach')
      }
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
