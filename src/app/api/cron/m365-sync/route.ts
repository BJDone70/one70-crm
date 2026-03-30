import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRecentEmails, getSentEmails, getCalendarEvents, updateSyncStatus } from '@/lib/microsoft-graph'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Match an email address to a CRM contact
async function matchContact(email: string): Promise<{ id: string; name: string; org_id: string | null } | null> {
  if (!email) return null
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, last_name, org_id')
    .ilike('email', email.trim())
    .is('deleted_at', null)
    .limit(1)
  if (data?.[0]) return { id: data[0].id, name: `${data[0].first_name} ${data[0].last_name}`, org_id: data[0].org_id }
  return null
}

// Match attendee emails to CRM contacts
async function matchAttendees(attendees: any[]): Promise<{ id: string; name: string; org_id: string | null } | null> {
  for (const a of attendees || []) {
    const email = a.emailAddress?.address
    if (email) {
      const match = await matchContact(email)
      if (match) return match
    }
  }
  return null
}

export async function GET() {
  const clientId = process.env.M365_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'M365 not configured' })

  try {
    // Get all users with M365 connected
    const { data: tokenRows } = await supabaseAdmin
      .from('m365_tokens')
      .select('user_id, last_sync_at, connected_email')
      .neq('sync_status', 'syncing')

    if (!tokenRows?.length) return NextResponse.json({ message: 'No M365 connections' })

    const results: any[] = []

    for (const row of tokenRows) {
      const userId = row.user_id
      await updateSyncStatus(userId, 'syncing')

      try {
        // Sync window: since last sync or last 24 hours
        const sinceDate = row.last_sync_at
          ? new Date(new Date(row.last_sync_at).getTime() - 60 * 60 * 1000).toISOString() // overlap by 1 hour
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        let emailsLogged = 0
        let meetingsLogged = 0

        // --- SYNC INBOUND EMAILS ---
        const inboundEmails = await getRecentEmails(userId, sinceDate, 50)
        for (const email of inboundEmails) {
          const senderEmail = email.from?.emailAddress?.address
          if (!senderEmail) continue

          // Skip internal/system emails
          if (senderEmail.includes('noreply') || senderEmail.includes('notification') || senderEmail.includes('mailer-daemon')) continue

          const contact = await matchContact(senderEmail)
          if (!contact) continue // Only log emails from known CRM contacts

          // Check if already logged (by subject + date + contact)
          const emailDate = email.receivedDateTime
          const { count } = await supabaseAdmin
            .from('email_interactions')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contact.id)
            .eq('subject', email.subject || 'No subject')
            .gte('received_at', new Date(new Date(emailDate).getTime() - 5 * 60 * 1000).toISOString())
            .lte('received_at', new Date(new Date(emailDate).getTime() + 5 * 60 * 1000).toISOString())

          if ((count || 0) > 0) continue // Already logged

          await supabaseAdmin.from('email_interactions').insert({
            user_id: userId,
            contact_id: contact.id,
            org_id: contact.org_id,
            direction: 'inbound',
            from_email: senderEmail,
            to_email: row.connected_email,
            subject: email.subject || 'No subject',
            snippet: (email.bodyPreview || '').substring(0, 300),
            received_at: emailDate,
            needs_reply: !email.isRead,
            source: 'monitored',
          })

          // Also log as activity
          await supabaseAdmin.from('activities').insert({
            type: 'email',
            subject: `Email from ${contact.name}: ${email.subject || 'No subject'}`,
            body: (email.bodyPreview || '').substring(0, 500),
            contact_id: contact.id,
            org_id: contact.org_id,
            user_id: userId,
            direction: 'inbound',
          })

          emailsLogged++
        }

        // --- SYNC SENT EMAILS ---
        const sentEmails = await getSentEmails(userId, sinceDate, 50)
        for (const email of sentEmails) {
          for (const recipient of (email.toRecipients || [])) {
            const recipientEmail = recipient.emailAddress?.address
            if (!recipientEmail) continue

            const contact = await matchContact(recipientEmail)
            if (!contact) continue

            // Dedup check
            const emailDate = email.sentDateTime
            const { count } = await supabaseAdmin
              .from('email_interactions')
              .select('id', { count: 'exact', head: true })
              .eq('contact_id', contact.id)
              .eq('direction', 'outbound')
              .eq('subject', email.subject || 'No subject')
              .gte('received_at', new Date(new Date(emailDate).getTime() - 5 * 60 * 1000).toISOString())

            if ((count || 0) > 0) continue

            await supabaseAdmin.from('email_interactions').insert({
              user_id: userId,
              contact_id: contact.id,
              org_id: contact.org_id,
              direction: 'outbound',
              from_email: row.connected_email || '',
              to_email: recipientEmail,
              subject: email.subject || 'No subject',
              snippet: (email.bodyPreview || '').substring(0, 300),
              received_at: emailDate,
              needs_reply: false,
              source: 'monitored',
            })

            await supabaseAdmin.from('activities').insert({
              type: 'email',
              subject: `Email to ${contact.name}: ${email.subject || 'No subject'}`,
              body: (email.bodyPreview || '').substring(0, 500),
              contact_id: contact.id,
              org_id: contact.org_id,
              user_id: userId,
              direction: 'outbound',
            })

            // Mark any "needs_reply" for this contact as replied
            await supabaseAdmin.from('email_interactions')
              .update({ needs_reply: false, replied_at: emailDate })
              .eq('contact_id', contact.id)
              .eq('needs_reply', true)
              .is('replied_at', null)
              .lt('received_at', emailDate)

            emailsLogged++
          }
        }

        // --- SYNC CALENDAR ---
        const now = new Date()
        const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

        const events = await getCalendarEvents(userId, pastWeek, nextWeek, 50)
        for (const event of events) {
          const contact = await matchAttendees(event.attendees || [])
          if (!contact) continue // Only log meetings with known CRM contacts

          const meetingDate = event.start?.dateTime
          if (!meetingDate) continue

          // Dedup
          const { count } = await supabaseAdmin
            .from('meeting_tracking')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('subject', event.subject || 'Meeting')
            .gte('meeting_date', new Date(new Date(meetingDate).getTime() - 30 * 60 * 1000).toISOString())
            .lte('meeting_date', new Date(new Date(meetingDate).getTime() + 30 * 60 * 1000).toISOString())

          if ((count || 0) > 0) continue

          const attendeeNames = (event.attendees || [])
            .map((a: any) => a.emailAddress?.name || a.emailAddress?.address)
            .filter(Boolean)
            .join(', ')

          const location = event.location?.displayName || event.onlineMeetingUrl || ''

          await supabaseAdmin.from('meeting_tracking').insert({
            user_id: userId,
            contact_id: contact.id,
            org_id: contact.org_id,
            subject: event.subject || 'Meeting',
            meeting_date: meetingDate + 'Z',
            location: location || null,
            attendees: attendeeNames || null,
            notes: (event.bodyPreview || '').substring(0, 500) || null,
            source: 'outlook',
          })

          // Log as activity if in the past
          if (new Date(meetingDate) < now) {
            await supabaseAdmin.from('activities').insert({
              type: 'meeting',
              subject: `Meeting: ${event.subject || 'Meeting'} with ${contact.name}`,
              body: `Attendees: ${attendeeNames}\nLocation: ${location}`,
              contact_id: contact.id,
              org_id: contact.org_id,
              user_id: userId,
              direction: 'outbound',
            })
          }

          meetingsLogged++
        }

        await updateSyncStatus(userId, 'idle')
        results.push({ user_id: userId, emails: emailsLogged, meetings: meetingsLogged })
      } catch (err: any) {
        console.error(`M365 sync error for user ${userId}:`, err.message)
        await updateSyncStatus(userId, 'error', err.message)
        results.push({ user_id: userId, error: err.message })
      }
    }

    return NextResponse.json({ success: true, synced: results })
  } catch (err: any) {
    console.error('M365 sync cron error:', err)
    return NextResponse.json({ error: err.message })
  }
}
