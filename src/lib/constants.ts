// Application constants

// Valid vertical values for real estate sectors
export const VERTICALS = [
  'multifamily',
  'hotel',
  'senior_living',
] as const

export type Vertical = typeof VERTICALS[number]

// Deal/task status constants
export const DEAL_STATUSES = [
  'new_lead',
  'contacted',
  'qualified',
  'discovery',
  'estimating',
  'proposal_sent',
  'negotiation',
  'awarded',
  'lost',
] as const

export const TASK_STATUSES = [
  'pending',
  'completed',
  'cancelled',
] as const

export const TASK_PRIORITIES = [
  'low',
  'medium',
  'high',
] as const

// Task types
export const TASK_TYPES = [
  'follow_up',
  'meeting',
  'call',
  'email',
  'proposal',
  'other',
] as const

// Activity types
export const ACTIVITY_TYPES = [
  'call',
  'email',
  'meeting',
  'note',
  'linkedin',
  'text',
  'site_visit',
  'other',
] as const
