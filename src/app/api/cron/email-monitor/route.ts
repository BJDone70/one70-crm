import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyStaleContact, notifyUnrepliedEmail } from '@/lib/notify'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Verify this is from Vercel Cron or has the secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'Not configured' })

  try {
    // Get all active users
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, timezone').eq('is_active', true)
    if (!profiles?.length) return NextResponse.json({ message: 'No active users' })

    const results: any[] = []

    for (const profile of profiles) {
      // Get contacts with email addresses for this user's orgs
      const { data: contacts } = await supabaseAdmin
        .from('contacts')
        .select('id, first_name, last_name, email, org_id')
        .not('email', 'is', null)
        .is('deleted_at', null)
        .limit(100)

      if (!contacts?.length) continue

      // Check for contacts with no recent activity (14+ days)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

      for (const contact of contacts) {
        // Check if there's recent activity
        const { count: recentActivityCount } = await supabaseAdmin
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id)
          .gte('occurred_at', twoWeeksAgo)

        // Check if there's already a pending task for this contact
        const { count: pendingTaskCount } = await supabaseAdmin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id)
          .eq('status', 'pending')
          .is('deleted_at', null)

        // Check recent email interactions
        const { count: recentEmailCount } = await supabaseAdmin
          .from('email_interactions')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id)
          .gte('received_at', twoWeeksAgo)

        const hasRecentTouch = (recentActivityCount || 0) > 0 || (recentEmailCount || 0) > 0
        const hasPendingTask = (pendingTaskCount || 0) > 0

        // If no recent activity and no pending task, flag for follow-up
        if (!hasRecentTouch && !hasPendingTask) {
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 3)

          await supabaseAdmin.from('tasks').insert({
            title: `Follow up with ${contact.first_name} ${contact.last_name}`,
            description: `Auto-generated: No interaction in 14+ days. Reach out to maintain the relationship.`,
            type: 'follow_up',
            priority: 'medium',
            due_date: dueDate.toISOString().split('T')[0],
            contact_id: contact.id,
            org_id: contact.org_id,
            assigned_to: profile.id,
            created_by: profile.id,
            status: 'pending',
          })

          // Log as activity for tracking
          await supabaseAdmin.from('activities').insert({
            type: 'note',
            subject: `Auto-follow-up: No interaction in 14+ days`,
            body: `CRM monitor detected no interactions with ${contact.first_name} ${contact.last_name} in the past 14 days. A follow-up task has been auto-created.`,
            contact_id: contact.id,
            org_id: contact.org_id,
            user_id: profile.id,
            direction: 'outbound',
          })

          results.push({
            user: profile.full_name,
            contact: `${contact.first_name} ${contact.last_name}`,
            action: 'Created follow-up task',
          })

          notifyStaleContact(profile.id, `${contact.first_name} ${contact.last_name}`, contact.id)
        }

        // Check for unreplied emails older than 3 days
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const { data: unreplied } = await supabaseAdmin
          .from('email_interactions')
          .select('id, subject')
          .eq('contact_id', contact.id)
          .eq('needs_reply', true)
          .is('replied_at', null)
          .lt('received_at', threeDaysAgo)
          .limit(1)

        if (unreplied?.length) {
          // Check if we already have a task about this
          const { count: existingFollowUp } = await supabaseAdmin
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contact.id)
            .eq('status', 'pending')
            .ilike('title', '%reply%')
            .is('deleted_at', null)

          if (!existingFollowUp) {
            await supabaseAdmin.from('tasks').insert({
              title: `Reply to ${contact.first_name} ${contact.last_name}: ${unreplied[0].subject}`,
              description: `Auto-generated: Email from ${contact.first_name} awaiting reply for 3+ days.`,
              type: 'follow_up',
              priority: 'high',
              due_date: new Date().toISOString().split('T')[0],
              contact_id: contact.id,
              org_id: contact.org_id,
              assigned_to: profile.id,
              created_by: profile.id,
              status: 'pending',
            })

            await supabaseAdmin.from('activities').insert({
              type: 'note',
              subject: `Auto-alert: Unreplied email (3+ days)`,
              body: `CRM monitor detected an unreplied email from ${contact.first_name} ${contact.last_name} (${unreplied[0].subject}). An urgent reply task has been auto-created.`,
              contact_id: contact.id,
              org_id: contact.org_id,
              user_id: profile.id,
              direction: 'inbound',
            })

            results.push({
              user: profile.full_name,
              contact: `${contact.first_name} ${contact.last_name}`,
              action: 'Created urgent reply task',
            })

            notifyUnrepliedEmail(profile.id, `${contact.first_name} ${contact.last_name}`, unreplied[0].subject)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: profiles.length,
      actions: results.length,
      results,
    })
  } catch (err: any) {
    console.error('Email monitor cron error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' })
  }
}
