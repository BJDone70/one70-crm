import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, platform, deviceName } = await request.json()

  if (!token || !platform) {
    return NextResponse.json({ error: 'Token and platform are required' }, { status: 400 })
  }

  if (!['ios', 'android'].includes(platform)) {
    return NextResponse.json({ error: 'Platform must be ios or android' }, { status: 400 })
  }

  // Upsert the token — if it exists for this user, update it; if another user had it, reassign
  // First deactivate this token for any other user
  await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .eq('token', token)
    .neq('user_id', user.id)

  // Upsert for current user
  const { error } = await supabase
    .from('device_tokens')
    .upsert({
      user_id: user.id,
      token,
      platform,
      device_name: deviceName || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' })

  if (error) {
    console.error('Failed to register device token:', error)
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 })
  }

  // Ensure notification preferences exist for this user (create defaults if not)
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prefs) {
    await supabase.from('notification_preferences').insert({ user_id: user.id })
  }

  return NextResponse.json({ success: true })
}
