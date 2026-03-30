export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyDealWon, notifyDealLost, notifyDealStageChanged, notifyTaskAssigned } from '@/lib/notify'

// Called when a deal stage changes — checks active workflows and runs matching actions
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deal_id, old_stage, new_stage, user_id } = await req.json()

  if (!deal_id || !new_stage) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // Determine trigger type
  let triggerType = 'deal_stage_change'
  if (new_stage === 'awarded') triggerType = 'deal_won'
  if (new_stage === 'lost') triggerType = 'deal_lost'

  // Find matching active workflows
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*, workflow_actions(*)')
    .eq('trigger_type', triggerType)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at')

  if (!workflows || workflows.length === 0) return NextResponse.json({ executed: 0 })

  // Get deal data for context
  const { data: deal } = await supabase
    .from('deals')
    .select('*, organizations(id, name), contacts(id, first_name, last_name, email), properties(id, name)')
    .eq('id', deal_id)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Get the name of the user who triggered this change
  const { data: changerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user_id || user.id)
    .single()
  const changerName = changerProfile?.full_name || 'Someone'

  let totalExecuted = 0

  for (const workflow of workflows) {
    const actions = (workflow.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)
    let actionsRun = 0
    let errorMsg = null

    for (const action of actions) {
      try {
        switch (action.action_type) {
          case 'create_project': {
            // Check if project already exists
            const { data: existing } = await supabase.from('projects')
              .select('id').eq('deal_id', deal_id).is('deleted_at', null).single()
            if (!existing) {
              const projectName = deal.properties?.name
                ? `${deal.organizations?.name || 'Project'} — ${deal.properties.name}`
                : deal.name
              // Get first project stage dynamically
              let firstStage = 'scoping'
              const { data: stData } = await supabase.from('project_stages').select('name').order('sort_order').limit(1)
              if (stData?.[0]) firstStage = stData[0].name

              await supabase.from('projects').insert({
                name: projectName, deal_id: deal.id, org_id: deal.org_id,
                property_id: deal.property_id, contact_id: deal.contact_id,
                assigned_to: deal.assigned_to, vertical: deal.vertical,
                status: firstStage, contract_value: deal.value,
                scope_description: deal.services_offered, created_by: user_id,
              })
            }
            break
          }

          case 'create_task': {
            const config = action.action_config || {}
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + (config.due_in_days || 3))
            const taskTitle = config.title || `Follow up: ${deal.name}`
            const taskAssignee = deal.assigned_to || user_id
            await supabase.from('tasks').insert({
              title: taskTitle,
              description: config.description || `Auto-created when deal moved to ${new_stage}`,
              type: config.task_type || 'follow_up',
              priority: config.priority || 'medium',
              due_date: dueDate.toISOString().split('T')[0],
              assigned_to: taskAssignee,
              contact_id: deal.contact_id, org_id: deal.org_id, deal_id: deal.id,
            })
            // Notify assignee
            if (taskAssignee && taskAssignee !== (user_id || user.id)) {
              notifyTaskAssigned(taskAssignee, taskTitle, changerName || 'Workflow')
            }
            break
          }

          case 'notify_team': {
            // Log a note visible to the whole team
            await supabase.from('activities').insert({
              type: 'note', direction: null,
              subject: `🔔 Workflow: ${workflow.name}`,
              body: `Deal "${deal.name}" moved to ${new_stage}. ${action.action_config?.message || ''}`,
              contact_id: deal.contact_id, org_id: deal.org_id, deal_id: deal.id,
              user_id: user_id,
            })
            break
          }

          case 'send_email': {
            if (deal.contacts?.email) {
              const config = action.action_config || {}
              const subject = (config.subject || 'Welcome from ONE70 Group')
                .replace('{deal_name}', deal.name)
                .replace('{contact_name}', `${deal.contacts.first_name} ${deal.contacts.last_name}`)
              const body = (config.body || 'Thank you for choosing ONE70 Group.')
                .replace('{deal_name}', deal.name)
                .replace('{contact_name}', `${deal.contacts.first_name} ${deal.contacts.last_name}`)
                .replace('{company}', deal.organizations?.name || '')

              await supabase.from('email_sends').insert({
                contact_id: deal.contact_id, to_email: deal.contacts.email,
                subject, body, status: 'sent', sent_by: user_id,
              })

              // Log activity
              await supabase.from('activities').insert({
                type: 'email', direction: 'outbound',
                subject: `Workflow: ${subject}`, body,
                contact_id: deal.contact_id, org_id: deal.org_id, deal_id: deal.id,
                user_id: user_id,
              })
            }
            break
          }

          case 'enroll_sequence': {
            if (deal.contact_id && action.action_config?.sequence_id) {
              const { data: existing } = await supabase.from('sequence_enrollments')
                .select('id').eq('sequence_id', action.action_config.sequence_id)
                .eq('contact_id', deal.contact_id).eq('status', 'active').single()

              if (!existing) {
                const { data: firstStep } = await supabase.from('sequence_steps')
                  .select('delay_days').eq('sequence_id', action.action_config.sequence_id)
                  .eq('step_number', 1).single()

                const nextAction = new Date()
                nextAction.setDate(nextAction.getDate() + (firstStep?.delay_days || 0))

                await supabase.from('sequence_enrollments').insert({
                  sequence_id: action.action_config.sequence_id,
                  contact_id: deal.contact_id, deal_id: deal.id,
                  current_step: 1, status: 'active',
                  enrolled_by: user_id, next_action_at: nextAction.toISOString(),
                })
              }
            }
            break
          }
        }
        actionsRun++
      } catch (err: any) {
        errorMsg = err.message
      }
    }

    // Log execution
    await supabase.from('workflow_log').insert({
      workflow_id: workflow.id, trigger_record_id: deal_id,
      trigger_record_type: 'deal',
      status: errorMsg ? 'partial' : 'success',
      actions_executed: actionsRun, error_message: errorMsg,
    })

    totalExecuted += actionsRun
  }

  // Fire push notifications based on deal stage change
  if (new_stage === 'awarded') {
    notifyDealWon(deal.name, user_id || user.id, deal.value)
  } else if (new_stage === 'lost') {
    notifyDealLost(deal.name, user_id || user.id)
  } else {
    // Notify deal owner if someone else moved it
    const ownerIds = [deal.assigned_to, deal.created_by].filter(Boolean) as string[]
    if (ownerIds.length > 0) {
      notifyDealStageChanged(ownerIds, deal.name, new_stage, changerName, user_id || user.id)
    }
  }

  return NextResponse.json({ executed: totalExecuted })
}
