import { createClient } from '@supabase/supabase-js'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface M365Tokens {
  access_token: string
  refresh_token: string
  expires_at: string
  connected_email: string | null
}

// Refresh token if expired
async function getValidToken(userId: string): Promise<string | null> {
  const { data: tokens } = await supabaseAdmin
    .from('m365_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokens) return null

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date(Date.now() + 5 * 60 * 1000)

  if (expiresAt > now) return tokens.access_token

  // Refresh the token
  const clientId = process.env.M365_CLIENT_ID
  const clientSecret = process.env.M365_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
    })

    if (!res.ok) {
      console.error('M365 token refresh failed:', res.status)
      await supabaseAdmin.from('m365_tokens').update({ sync_status: 'error', sync_error: 'Token refresh failed' }).eq('user_id', userId)
      return null
    }

    const data = await res.json()
    const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

    await supabaseAdmin.from('m365_tokens').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      sync_status: 'idle',
      sync_error: null,
    }).eq('user_id', userId)

    return data.access_token
  } catch (err: any) {
    console.error('M365 refresh error:', err.message)
    return null
  }
}

// Generic Graph API call
async function graphFetch(userId: string, endpoint: string, options?: RequestInit): Promise<any> {
  const token = await getValidToken(userId)
  if (!token) return null

  const res = await fetch(`${GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`Graph API error (${endpoint}):`, res.status, errText)
    return null
  }

  // Handle 202/204 (no body) responses — sendMail returns 202
  if (res.status === 202 || res.status === 204) return { success: true }

  const text = await res.text()
  if (!text) return { success: true }
  try { return JSON.parse(text) } catch { return { success: true } }
}

// Get recent emails
export async function getRecentEmails(userId: string, sinceDate: string, limit = 25) {
  const filter = `receivedDateTime ge ${sinceDate}`
  const data = await graphFetch(userId,
    `/me/messages?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments`)
  return data?.value || []
}

// Get sent emails
export async function getSentEmails(userId: string, sinceDate: string, limit = 25) {
  const filter = `sentDateTime ge ${sinceDate}`
  const data = await graphFetch(userId,
    `/me/mailFolders/SentItems/messages?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=sentDateTime desc&$select=id,subject,from,toRecipients,sentDateTime,bodyPreview`)
  return data?.value || []
}

// Search emails by sender
export async function searchEmailsBySender(userId: string, senderEmail: string, limit = 10) {
  const filter = `from/emailAddress/address eq '${senderEmail}'`
  const data = await graphFetch(userId,
    `/me/messages?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead`)
  return data?.value || []
}

// Get calendar events
export async function getCalendarEvents(userId: string, startDate: string, endDate: string, limit = 25) {
  const data = await graphFetch(userId,
    `/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$top=${limit}&$orderby=start/dateTime&$select=id,subject,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeetingUrl,bodyPreview`)
  return data?.value || []
}

// Send email via Microsoft Graph
export async function sendEmail(userId: string, to: string[], subject: string, body: string, cc?: string[], isHtml = true) {
  const message: any = {
    subject,
    body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
    toRecipients: to.map(email => ({ emailAddress: { address: email } })),
  }
  if (cc?.length) {
    message.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }))
  }

  const result = await graphFetch(userId, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  // sendMail returns 202 with no body on success — graphFetch may return null
  return { success: true }
}

// Create draft email (saves to Drafts folder, doesn't send)
export async function createDraft(userId: string, to: string[], subject: string, body: string, cc?: string[]) {
  const message: any = {
    subject,
    body: { contentType: 'HTML', content: body },
    toRecipients: to.map(email => ({ emailAddress: { address: email } })),
  }
  if (cc?.length) {
    message.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }))
  }

  return await graphFetch(userId, '/me/messages', {
    method: 'POST',
    body: JSON.stringify(message),
  })
}

// Check if user has M365 connected
export async function isM365Connected(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('m365_tokens')
    .select('id')
    .eq('user_id', userId)
    .single()
  return !!data
}

// Get connection status
export async function getM365Status(userId: string) {
  const { data } = await supabaseAdmin
    .from('m365_tokens')
    .select('connected_email, connected_at, last_sync_at, sync_status, sync_error')
    .eq('user_id', userId)
    .single()
  return data
}

// Disconnect M365
export async function disconnectM365(userId: string) {
  await supabaseAdmin.from('m365_tokens').delete().eq('user_id', userId)
}

// Update last sync time
export async function updateSyncStatus(userId: string, status: string, error?: string) {
  await supabaseAdmin.from('m365_tokens').update({
    sync_status: status,
    last_sync_at: new Date().toISOString(),
    sync_error: error || null,
  }).eq('user_id', userId)
}

export { getValidToken, graphFetch }

// Search people (M365 directory + frequent contacts)
export async function searchPeople(userId: string, query: string, limit = 10) {
  if (!query || query.length < 2) return []
  const data = await graphFetch(userId,
    `/me/people?$search="${encodeURIComponent(query)}"&$top=${limit}&$select=displayName,emailAddresses,companyName,jobTitle,department`)
  return (data?.value || []).map((p: any) => ({
    name: p.displayName,
    email: p.emailAddresses?.[0]?.address || '',
    company: p.companyName || '',
    title: p.jobTitle || '',
  })).filter((p: any) => p.email)
}

// Get M365 contacts (address book)
export async function getContacts(userId: string, limit = 50) {
  const data = await graphFetch(userId,
    `/me/contacts?$top=${limit}&$orderby=displayName&$select=displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle,businessAddress`)
  return (data?.value || []).map((c: any) => ({
    first_name: c.givenName || '',
    last_name: c.surname || '',
    email: c.emailAddresses?.[0]?.address || '',
    phone: c.businessPhones?.[0] || '',
    mobile_phone: c.mobilePhone || '',
    company: c.companyName || '',
    title: c.jobTitle || '',
    address: c.businessAddress ? `${c.businessAddress.street || ''}, ${c.businessAddress.city || ''}, ${c.businessAddress.state || ''} ${c.businessAddress.postalCode || ''}`.replace(/^,\s*|,\s*$/g, '').trim() : '',
  }))
}

// Search M365 contacts
export async function searchContacts(userId: string, query: string, limit = 10) {
  if (!query || query.length < 2) return []
  const data = await graphFetch(userId,
    `/me/contacts?$filter=startswith(displayName,'${encodeURIComponent(query)}') or startswith(givenName,'${encodeURIComponent(query)}') or startswith(surname,'${encodeURIComponent(query)}')&$top=${limit}&$select=displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle`)
  return (data?.value || []).map((c: any) => ({
    first_name: c.givenName || '',
    last_name: c.surname || '',
    email: c.emailAddresses?.[0]?.address || '',
    phone: c.businessPhones?.[0] || '',
    mobile_phone: c.mobilePhone || '',
    company: c.companyName || '',
    title: c.jobTitle || '',
  }))
}
