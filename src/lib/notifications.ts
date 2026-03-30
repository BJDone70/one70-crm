import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NotificationData {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  metadata?: Record<string, any>
}

export async function createNotification(data: NotificationData) {
  return supabaseAdmin.from('notifications').insert({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body || null,
    link: data.link || null,
    metadata: data.metadata || {},
  })
}

export async function notifyUser(userId: string, type: string, title: string, body?: string, link?: string) {
  return createNotification({ userId, type, title, body, link })
}

// Notify all active users (for system-wide events)
export async function notifyAllUsers(type: string, title: string, body?: string, link?: string) {
  const { data: users } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true)
  if (!users?.length) return
  const rows = users.map(u => ({
    user_id: u.id, type, title, body: body || null, link: link || null, metadata: {},
  }))
  return supabaseAdmin.from('notifications').insert(rows)
}

// Notify all users except the actor
export async function notifyOthers(actorId: string, type: string, title: string, body?: string, link?: string) {
  const { data: users } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true).neq('id', actorId)
  if (!users?.length) return
  const rows = users.map(u => ({
    user_id: u.id, type, title, body: body || null, link: link || null, metadata: {},
  }))
  return supabaseAdmin.from('notifications').insert(rows)
}
