export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { notifySequenceActionDue } from '@/lib/notify'
import { apiError } from '@/lib/api-error'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || 'ONE70 CRM <onboarding@resend.dev>'

function mergePlaceholders(text: string, data: Record<string, string>): string {
  // Use regex replace with replacer function to prevent double-replacement of values
  // This is a single-pass replacement that won't re-process replaced values
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const value = data[key]
    return value !== undefined ? value : `{${key}}`
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enrollment_id } = await req.json()

  if (!enrollment_id) return NextResponse.json({ error: 'Missing enrollment_id' }, { status: 400 })

  // Get enrollment with contact + org info
  const { data: enrollment } = await supabase
    .from('sequence_enrollments')
    .select('*, contacts(id, first_name, last_name, email, phone, linkedin_url, org_id, organizations:org_id(name)), sequences(name, vertical)')
    .eq('id', enrollment_id)
    .eq('enrolled_by', user.id)
    .single()

  if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  if (enrollment.status !== 'active') return NextResponse.json({ error: 'Enrollment not active' }, { status: 400 })

  // Get current step
  const { data: step } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('sequence_id', enrollment.sequence_id)
    .eq('step_number', enrollment.current_step)
    .single()

  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  const contact = enrollment.contacts
  const orgName = contact?.organizations?.name || ''

  // Get current user's profile for {your_name}
  let yourName = 'ONE70 Group'
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  if (profile) yourName = profile.full_name

  // Merge field data
  const mergeData: Record<string, string> = {
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    full_name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
    company: orgName,
    email: contact?.email || '',
    phone: contact?.phone || '',
    property_name: '', // could be enhanced with deal/property data
    city: '',
    your_name: yourName,
  }

  // If deal is linked, get property info
  if (enrollment.deal_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('name, properties(name, city, state)')
      .eq('id', enrollment.deal_id)
      .single()
    if (deal?.properties) {
      mergeData.property_name = (deal.properties as any).name || ''
      mergeData.city = (deal.properties as any).city || ''
    }
  }

  const mergedSubject = mergePlaceholders(step.subject || '', mergeData)
  const mergedBody = mergePlaceholders(step.body || '', mergeData)

  let emailSendId = null

  // Execute based on channel
  if (step.channel === 'email' && contact?.email) {
    try {
      const { data: emailResult, error: emailErr } = await resend.emails.send({
        from: FROM_EMAIL,
        to: contact.email,
        subject: mergedSubject,
        html: `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 600px;">
          ${mergedBody.split('\n').map((line: string) => line.trim() ? `<p style="margin: 0 0 12px;">${line}</p>` : '<br/>').join('')}
        </div>`,
      })

      if (emailErr) {
        console.error('[sequences-execute] Email send error:', emailErr)
      }

      // Track the send
      const { data: sendRecord } = await supabase.from('email_sends').insert({
        enrollment_id: enrollment.id,
        contact_id: contact.id,
        to_email: contact.email,
        subject: mergedSubject,
        body: mergedBody,
        status: emailErr ? 'failed' : 'sent',
        resend_id: emailResult?.id || null,
        sent_by: user?.id,
      }).select('id').single()

      emailSendId = sendRecord?.id
    } catch (err) {
      console.error('[sequences-execute] Email execution failed:', err)
    }
  }

  // Log activity
  await supabase.from('activities').insert({
    type: step.channel === 'call' ? 'call' : step.channel === 'linkedin' ? 'linkedin' : step.channel === 'text' ? 'text' : 'email',
    subject: `Sequence: ${enrollment.sequences?.name} — Step ${enrollment.current_step}`,
    body: step.channel === 'email' ? `Subject: ${mergedSubject}\n\n${mergedBody}` : mergedBody,
    direction: 'outbound',
    contact_id: contact?.id,
    org_id: contact?.org_id,
    deal_id: enrollment.deal_id,
    user_id: user?.id,
  })

  // Get total steps to know if we're done
  const { count: totalSteps } = await supabase
    .from('sequence_steps')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_id', enrollment.sequence_id)

  const nextStepNum = enrollment.current_step + 1

  if (nextStepNum > (totalSteps || 0)) {
    // Sequence complete
    await supabase.from('sequence_enrollments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', enrollment.id)
  } else {
    // Get next step delay
    const { data: nextStep } = await supabase
      .from('sequence_steps')
      .select('delay_days')
      .eq('sequence_id', enrollment.sequence_id)
      .eq('step_number', nextStepNum)
      .single()

    const nextActionDate = new Date()
    nextActionDate.setDate(nextActionDate.getDate() + (nextStep?.delay_days || 3))

    await supabase.from('sequence_enrollments').update({
      current_step: nextStepNum,
      next_action_at: nextActionDate.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', enrollment.id)

    // Notify the user when the next step is due (same day = notify now)
    if (nextStep?.delay_days === 0 && enrollment.enrolled_by) {
      const contactName = `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
      notifySequenceActionDue(enrollment.enrolled_by, contactName, 'Outreach step')
    }
  }

  return NextResponse.json({ success: true, email_send_id: emailSendId })
}
