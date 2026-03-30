import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyDealStageChanged, notifyDealWon, notifyDealLost } from '@/lib/notify'
import { WON_STAGE, LOST_STAGE, PIPELINE_STAGES } from '@/lib/stages'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { deal_id, old_stage, new_stage, user_id } = await request.json()
    if (!deal_id || !new_stage || !user_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Get deal info
    const { data: deal } = await supabaseAdmin.from('deals').select('name, value, assigned_to, org_id').eq('id', deal_id).single()
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // Get changer's name
    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single()
    const changerName = profile?.full_name || 'Someone'

    const stageLabel = PIPELINE_STAGES.find(s => s.id === new_stage)?.label || new_stage

    if (new_stage === WON_STAGE) {
      notifyDealWon(deal.name, user_id, deal.value ? Number(deal.value) : undefined, deal_id)
    } else if (new_stage === LOST_STAGE) {
      notifyDealLost(deal.name, user_id, deal_id)
    } else {
      // Notify deal owner + all active users
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true)
      const userIds = (profiles || []).map(p => p.id)
      notifyDealStageChanged(userIds, deal.name, stageLabel, changerName, user_id, deal_id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
