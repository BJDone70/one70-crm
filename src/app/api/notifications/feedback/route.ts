import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { action, feedback_id, subject, status, user_id, notify_user_id } = await request.json()
    if (!action || !feedback_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Get the commenter/changer's name
    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single()
    const userName = profile?.full_name || 'Someone'

    // Gather all participants: feedback creator + all commenters
    const participantIds = new Set<string>()

    // Add the feedback creator
    if (notify_user_id) participantIds.add(notify_user_id)

    // Get the feedback creator from DB
    const { data: feedback } = await supabaseAdmin
      .from('feedback')
      .select('user_id')
      .eq('id', feedback_id)
      .single()
    if (feedback) participantIds.add(feedback.user_id)

    // Add all unique commenters on this thread
    const { data: comments } = await supabaseAdmin
      .from('feedback_comments')
      .select('user_id')
      .eq('feedback_id', feedback_id)
    if (comments) {
      comments.forEach(c => participantIds.add(c.user_id))
    }

    // Remove the person who triggered the action (don't notify yourself)
    participantIds.delete(user_id)

    if (participantIds.size === 0) return NextResponse.json({ success: true, notified: 0 })

    // Build notifications for all participants
    const notifications: any[] = []

    if (action === 'comment') {
      for (const uid of participantIds) {
        notifications.push({
          user_id: uid,
          type: 'system',
          title: 'New comment on feedback',
          body: `${userName} commented on "${subject}"`,
          link: '/feedback',
        })
      }
    } else if (action === 'status') {
      const statusLabels: Record<string, string> = {
        open: 'Open', in_progress: 'In Progress', done: 'Done', wont_fix: "Won't Fix",
      }
      for (const uid of participantIds) {
        notifications.push({
          user_id: uid,
          type: 'system',
          title: 'Feedback status updated',
          body: `"${subject}" changed to ${statusLabels[status] || status} by ${userName}`,
          link: '/feedback',
        })
      }
    }

    if (notifications.length > 0) {
      await supabaseAdmin.from('notifications').insert(notifications)
    }

    return NextResponse.json({ success: true, notified: notifications.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
