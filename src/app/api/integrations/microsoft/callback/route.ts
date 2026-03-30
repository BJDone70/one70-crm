import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'

  if (error || !code) {
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=microsoft_auth_failed`)
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirect = `${siteUrl}/api/integrations/microsoft/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=microsoft_not_configured`)
  }

  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirect, grant_type: 'authorization_code',
        scope: 'Mail.Read Calendars.Read offline_access',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return NextResponse.redirect(`${siteUrl}/settings/integrations?error=microsoft_token_failed`)
    }

    // Get user email
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${siteUrl}/login`)

    const { data: existing } = await supabase.from('integrations')
      .select('id').eq('user_id', user.id).eq('provider', 'microsoft').single()

    if (existing) {
      await supabase.from('integrations').update({
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        email_address: profile.mail || profile.userPrincipalName, is_active: true,
        scopes: ['Mail.Read', 'Calendars.Read'], updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert({
        user_id: user.id, provider: 'microsoft',
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        email_address: profile.mail || profile.userPrincipalName, is_active: true,
        scopes: ['Mail.Read', 'Calendars.Read'],
      })
    }

    return NextResponse.redirect(`${siteUrl}/settings/integrations?success=microsoft`)
  } catch (err) {
    console.error('Microsoft OAuth error:', err)
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=microsoft_failed`)
  }
}
