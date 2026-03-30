// Push notification sender — supports APNs (iOS)
// Requires env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8 (base64-encoded .p8 file contents)

import { createAdminClient } from '@/lib/supabase/admin'
import { nowInTimezone } from '@/lib/timezone'

interface PushPayload {
  title: string
  body: string
  category: string
  data?: Record<string, string>
  badge?: number
  sound?: string
}

interface SendResult {
  sent: number
  failed: number
  errors: string[]
}

// Generate JWT for APNs authentication
async function generateApnsJwt(): Promise<{ jwt: string | null; error?: string }> {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const keyP8 = process.env.APNS_KEY_P8

  if (!keyId) return { jwt: null, error: 'APNS_KEY_ID not set' }
  if (!teamId) return { jwt: null, error: 'APNS_TEAM_ID not set' }
  if (!keyP8) return { jwt: null, error: 'APNS_KEY_P8 not set' }

  try {
    // Decode base64 key
    const keyData = Buffer.from(keyP8, 'base64').toString('utf-8')

    if (!keyData.includes('BEGIN PRIVATE KEY')) {
      return { jwt: null, error: 'APNS_KEY_P8 decoded but does not contain a valid private key. Re-encode the .p8 file.' }
    }

    // JWT header
    const header = Buffer.from(JSON.stringify({
      alg: 'ES256', kid: keyId
    })).toString('base64url')

    // JWT claims
    const now = Math.floor(Date.now() / 1000)
    const claims = Buffer.from(JSON.stringify({
      iss: teamId, iat: now
    })).toString('base64url')

    // Sign with the p8 key
    const crypto = await import('crypto')
    const sign = crypto.createSign('SHA256')
    sign.update(`${header}.${claims}`)
    const signature = sign.sign(keyData, 'base64url')

    return { jwt: `${header}.${claims}.${signature}` }
  } catch (err: any) {
    console.error('Failed to generate APNs JWT:', err)
    return { jwt: null, error: `Key signing failed: ${err.message}` }
  }
}

// Send push to a single device token
async function sendToDevice(
  token: string,
  payload: PushPayload,
  jwt: string
): Promise<{ success: boolean; error?: string }> {
  const http2 = require('http2')
  const isProduction = process.env.NODE_ENV === 'production'
  const host = isProduction
    ? 'api.push.apple.com'
    : 'api.sandbox.push.apple.com'

  const apnsPayload = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      badge: payload.badge || 0,
      sound: payload.sound || 'default',
      'category': payload.category,
      'thread-id': payload.category,
    },
    ...payload.data,
  }

  return new Promise((resolve) => {
    try {
      const client = http2.connect(`https://${host}`)

      client.on('error', (err: any) => {
        client.close()
        resolve({ success: false, error: `Connection error: ${err.message}` })
      })

      const body = JSON.stringify(apnsPayload)
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        'authorization': `bearer ${jwt}`,
        'apns-topic': 'com.one70group.crm',
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      })

      let responseData = ''
      let statusCode = 0

      req.on('response', (headers: any) => {
        statusCode = headers[':status']
      })

      req.on('data', (chunk: any) => {
        responseData += chunk
      })

      req.on('end', () => {
        client.close()
        if (statusCode === 200) {
          resolve({ success: true })
        } else {
          try {
            const err = JSON.parse(responseData)
            resolve({ success: false, error: `${statusCode}: ${err.reason || 'Unknown'}` })
          } catch {
            resolve({ success: false, error: `${statusCode}: ${responseData || 'Unknown error'}` })
          }
        }
      })

      req.on('error', (err: any) => {
        client.close()
        resolve({ success: false, error: `Request error: ${err.message}` })
      })

      // Set a timeout
      req.setTimeout(10000, () => {
        req.close()
        client.close()
        resolve({ success: false, error: 'Request timeout' })
      })

      req.write(body)
      req.end()
    } catch (err: any) {
      resolve({ success: false, error: err.message })
    }
  })
}

// Send notification to a specific user (all their active devices)
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] }

  const { jwt, error: jwtError } = await generateApnsJwt()
  if (!jwt) {
    result.errors.push(jwtError || 'APNs not configured')
    return result
  }

  const supabase = createAdminClient()

  // Check user's notification preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  // If user has preferences and this category is disabled, skip
  if (prefs) {
    const categoryMap: Record<string, string> = {
      'task_due': 'task_due_today',
      'task_assigned': 'task_assigned',
      'deal_stage': 'deal_stage_changed',
      'deal_won': 'deal_won',
      'deal_lost': 'deal_lost',
      'sequence': 'sequence_action_due',
      'project': 'project_status_changed',
      'digest': 'daily_digest',
    }
    const prefKey = categoryMap[payload.category]
    if (prefKey && prefs[prefKey] === false) {
      return result // User disabled this notification type
    }

    // Check quiet hours (skip for test notifications)
    if (payload.category !== 'test' && prefs.quiet_hours_start && prefs.quiet_hours_end) {
      // Look up user's timezone
      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single()
      const userTz = profile?.timezone || 'America/New_York'
      const userNow = nowInTimezone(userTz)
      const currentTime = userNow.timeString
      const start = prefs.quiet_hours_start
      const end = prefs.quiet_hours_end

      if (start > end) {
        if (currentTime >= start || currentTime < end) return result
      } else {
        if (currentTime >= start && currentTime < end) return result
      }
    }
  }

  // Get user's active device tokens
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!tokens || tokens.length === 0) return result

  // Send to all iOS devices
  for (const device of tokens) {
    if (device.platform === 'ios') {
      const res = await sendToDevice(device.token, payload, jwt)
      if (res.success) {
        result.sent++
      } else {
        result.failed++
        result.errors.push(res.error || 'Unknown error')

        // Deactivate invalid tokens
        if (res.error?.includes('BadDeviceToken') || res.error?.includes('Unregistered')) {
          await supabase
            .from('device_tokens')
            .update({ is_active: false })
            .eq('token', device.token)
        }
      }
    }
  }

  // Log the notification
  await supabase.from('notification_log').insert({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    category: payload.category,
    data: payload.data || {},
    delivered: result.sent > 0,
    error: result.errors.length > 0 ? result.errors.join('; ') : null,
  })

  return result
}

// Send notification to multiple users
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<SendResult> {
  const totals: SendResult = { sent: 0, failed: 0, errors: [] }

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload)
    totals.sent += result.sent
    totals.failed += result.failed
    totals.errors.push(...result.errors)
  }

  return totals
}

// Send notification to all active users (team-wide)
export async function sendPushToTeam(
  payload: PushPayload,
  excludeUserId?: string
): Promise<SendResult> {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)

  if (!profiles) return { sent: 0, failed: 0, errors: ['No active users found'] }

  const userIds = profiles
    .map(p => p.id)
    .filter(id => id !== excludeUserId)

  return sendPushToUsers(userIds, payload)
}
