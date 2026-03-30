// Notification triggers — sends push + creates in-app notifications
// All calls are fire-and-forget (don't await in the request path)

import { sendPushToUser, sendPushToTeam } from '@/lib/push'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Create in-app notification
async function inApp(userId: string, type: string, title: string, body?: string, link?: string) {
  await supabaseAdmin.from('notifications').insert({
    user_id: userId, type, title, body: body || null, link: link || null,
  }).then(({ error }) => { if (error) console.error('In-app notification error:', error.message) })
}

async function inAppForAll(type: string, title: string, body?: string, link?: string, excludeUserId?: string) {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true)
  for (const p of profiles || []) {
    if (p.id === excludeUserId) continue
    await inApp(p.id, type, title, body, link)
  }
}

export function notifyTaskAssigned(assigneeId: string, taskTitle: string, assignerName: string, taskId?: string) {
  const title = `New task from ${assignerName}`
  const body = taskTitle
  const link = taskId ? `/tasks/${taskId}` : '/tasks'
  sendPushToUser(assigneeId, { title, body, category: 'task_assigned', data: { type: 'task_assigned' } }).catch((err) => console.error('[notify] Failed to send task assigned push:', err))
  inApp(assigneeId, 'task_assigned', title, body, link).catch((err) => console.error('[notify] Failed to create task assigned in-app notification:', err))
}

export function notifyTaskCompleted(taskTitle: string, completedByName: string, notifyUserId: string, taskId?: string) {
  const title = `Task completed by ${completedByName}`
  const link = taskId ? `/tasks/${taskId}` : '/tasks'
  inApp(notifyUserId, 'task_completed', title, taskTitle, link).catch(() => {})
}

export function notifyDealStageChanged(
  dealOwnerIds: string[],
  dealTitle: string,
  newStage: string,
  changedByName: string,
  changedById: string,
  dealId?: string
) {
  const link = dealId ? `/deals/${dealId}` : '/deals'
  for (const userId of dealOwnerIds) {
    if (userId === changedById) continue
    const title = `Deal moved to ${newStage}`
    const body = `${dealTitle} — by ${changedByName}`
    sendPushToUser(userId, { title: 'Deal Moved', body: `${changedByName} moved "${dealTitle}" to ${newStage}`, category: 'deal_stage', data: { type: 'deal_stage' } }).catch(() => {})
    inApp(userId, 'deal_stage', title, body, link).catch(() => {})
  }
}

export function notifyDealWon(dealTitle: string, wonById: string, amount?: number, dealId?: string) {
  const body = amount ? `$${amount.toLocaleString()}` : undefined
  const link = dealId ? `/deals/${dealId}` : '/deals'
  sendPushToTeam({ title: 'Deal Won!', body: amount ? `"${dealTitle}" — $${amount.toLocaleString()}` : `"${dealTitle}" was won`, category: 'deal_won', data: { type: 'deal_won' } }, wonById).catch((err) => console.error('[notify] Failed to send deal won push:', err))
  inAppForAll('deal_won', `Deal won: ${dealTitle}`, body, link).catch((err) => console.error('[notify] Failed to create deal won in-app notification:', err))
}

export function notifyDealLost(dealTitle: string, lostById: string, dealId?: string) {
  const link = dealId ? `/deals/${dealId}` : '/deals'
  sendPushToTeam({ title: 'Deal Lost', body: `"${dealTitle}" was lost`, category: 'deal_lost', data: { type: 'deal_lost' } }, lostById).catch((err) => console.error('[notify] Failed to send deal lost push:', err))
  inAppForAll('deal_lost', `Deal lost: ${dealTitle}`, undefined, link, lostById).catch((err) => console.error('[notify] Failed to create deal lost in-app notification:', err))
}

export function notifySequenceActionDue(userId: string, contactName: string, stepType: string) {
  sendPushToUser(userId, { title: 'Outreach Due', body: `${stepType} ready for ${contactName}`, category: 'sequence', data: { type: 'sequence_action_due' } }).catch((err) => console.error('[notify] Failed to send sequence action push:', err))
  inApp(userId, 'system', `Outreach due: ${contactName}`, `${stepType} ready`, '/outreach').catch((err) => console.error('[notify] Failed to create sequence action in-app notification:', err))
}

export function notifyProjectStatusChanged(teamUserIds: string[], projectName: string, newStatus: string, changedById: string, projectId?: string) {
  const link = projectId ? `/projects/${projectId}` : '/projects'
  for (const userId of teamUserIds) {
    if (userId === changedById) continue
    sendPushToUser(userId, { title: 'Project Update', body: `"${projectName}" moved to ${newStatus}`, category: 'project', data: { type: 'project_status' } }).catch(() => {})
    inApp(userId, 'system', `Project: ${projectName}`, `Moved to ${newStatus}`, link).catch(() => {})
  }
}

export function notifyStaleContact(userId: string, contactName: string, contactId: string) {
  inApp(userId, 'contact_stale', `No interaction in 14+ days: ${contactName}`, 'A follow-up task has been created', `/contacts/${contactId}`).catch(() => {})
}

export function notifyUnrepliedEmail(userId: string, contactName: string, subject: string) {
  inApp(userId, 'email_unreplied', `Unreplied email from ${contactName}`, subject, '/emails').catch(() => {})
}
