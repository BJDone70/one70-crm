// Single source of truth for pipeline stages
export const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified / Site Visit' },
  { id: 'estimating', label: 'Estimating in Progress' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'awarded', label: 'Awarded' },
  { id: 'lost', label: 'Lost / No-Go' },
] as const

// Active stages (excludes terminal)
export const ACTIVE_STAGE_IDS = ['new_lead', 'contacted', 'qualified', 'estimating', 'proposal_sent', 'negotiation'] as const

// Terminal stages
export const WON_STAGE = 'awarded'
export const LOST_STAGE = 'lost'

// For pipeline boards with colors
export const PIPELINE_STAGES_COLORED = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-gray-100 border-gray-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-300' },
  { id: 'qualified', label: 'Qualified / Site Visit', color: 'bg-indigo-50 border-indigo-300' },
  { id: 'estimating', label: 'Estimating in Progress', color: 'bg-purple-50 border-purple-300' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-50 border-amber-300' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-300' },
  { id: 'awarded', label: 'Awarded', color: 'bg-green-50 border-green-400' },
  { id: 'lost', label: 'Lost / No-Go', color: 'bg-red-50 border-red-300' },
] as const

// Stage labels lookup
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map(s => [s.id, s.label])
)

// Helper: is this a terminal stage?
export function isTerminalStage(stage: string): boolean {
  return stage === WON_STAGE || stage === LOST_STAGE
}

// Helper: is this deal "won"?
export function isWonStage(stage: string): boolean {
  return stage === WON_STAGE
}

// Helper: is this deal "lost"?
export function isLostStage(stage: string): boolean {
  return stage === LOST_STAGE
}
