import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await sendPushToUser(user.id, {
    title: 'ONE70 CRM',
    body: 'Push notifications are working!',
    category: 'test',
    data: { type: 'test' },
  })

  return NextResponse.json(result)
}
