import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'))

  const clientId = process.env.M365_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'M365 not configured' }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'}/api/m365/callback`
  const scope = 'openid profile email offline_access Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read People.Read User.Read'

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_mode=query` +
    `&state=${user.id}` +
    `&prompt=select_account`

  return NextResponse.redirect(authUrl)
}
