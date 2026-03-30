import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'

  if (error || !code) {
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=google_auth_failed`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirect = `${siteUrl}/api/integrations/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=google_not_configured`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirect, grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return NextResponse.redirect(`${siteUrl}/settings/integrations?error=google_token_failed`)
    }

    // Get user email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.redirect(`${siteUrl}/login`)

    // Upsert integration
    const { data: existing } = await supabase.from('integrations')
      .select('id').eq('user_id', user.id).eq('provider', 'google').single()

    if (existing) {
      await supabase.from('integrations').update({
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        email_address: profile.email, is_active: true,
        scopes: ['gmail.readonly', 'calendar.readonly'],
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert({
        user_id: user.id, provider: 'google',
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        email_address: profile.email, is_active: true,
        scopes: ['gmail.readonly', 'calendar.readonly'],
      })
    }

    return NextResponse.redirect(`${siteUrl}/settings/integrations?success=google`)
  } catch (err) {
    console.error('Google OAuth error:', err)
    return NextResponse.redirect(`${siteUrl}/settings/integrations?error=google_failed`)
  }
}
