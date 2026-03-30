import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'

  if (error) {
    console.error('M365 OAuth error:', error, errorDesc)
    const msg = errorDesc || error
    return NextResponse.redirect(`${origin}/settings/integrations?m365=error&msg=${encodeURIComponent(msg)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings/integrations?m365=error&msg=${encodeURIComponent('Missing authorization code. Please try again.')}`)
  }

  const clientId = process.env.M365_CLIENT_ID
  const clientSecret = process.env.M365_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/settings/integrations?m365=error&msg=not_configured`)
  }

  const redirectUri = `${origin}/api/m365/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email offline_access Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read People.Read User.Read',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('M365 token exchange failed:', err)
      return NextResponse.redirect(`${origin}/settings/integrations?m365=error&msg=token_exchange_failed`)
    }

    const tokens = await tokenRes.json()

    // Get user's email from Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = profileRes.ok ? await profileRes.json() : {}
    const connectedEmail = profile.mail || profile.userPrincipalName || ''

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

    // Upsert tokens
    await supabaseAdmin.from('m365_tokens').upsert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      connected_email: connectedEmail,
      connected_at: new Date().toISOString(),
      sync_status: 'idle',
      sync_error: null,
    }, { onConflict: 'user_id' })

    return NextResponse.redirect(`${origin}/settings/integrations?m365=connected&email=${encodeURIComponent(connectedEmail)}`)
  } catch (err: any) {
    console.error('M365 callback error:', err)
    return NextResponse.redirect(`${origin}/settings/integrations?m365=error&msg=${encodeURIComponent(err.message)}`)
  }
}
