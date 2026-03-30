import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configured = !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_P8)

  // Check if this user has any device tokens registered
  const { count } = await supabase
    .from('device_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return NextResponse.json({
    apns_configured: configured,
    device_registered: (count || 0) > 0,
    device_count: count || 0,
  })
}
