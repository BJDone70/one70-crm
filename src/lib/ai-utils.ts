// Shared AI utilities for Claude-powered CRM features

export async function callClaude(systemPrompt: string, userPrompt: string, maxTokens: number = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Claude API error:', err)
    throw new Error('Failed to generate response')
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ============================================================
// PLAYBOOK CONTENT — embedded from the sales system docs
// ============================================================

export const PLAYBOOKS = {
  multifamily: {
    vertical: 'Multifamily',
    tagline: 'Full-Scope Commercial Construction | Multifamily Specialists | Eastern USA',
    idealClient: '60+ units, 5+ concurrent projects, $25K+ common area scope, Eastern USA footprint',
    painPoints: [
      'Change orders that blow up budgets mid-project',
      'Contractors who go quiet once the job starts',
      'Schedules that slip, slowing unit turns and costing revenue',
      'Multiple vendors with fragmented accountability',
    ],
    threeUniques: {
      clearCost: 'Software-based pricing with line-item specificity. Real budget, not a guess.',
      clearSchedule: 'Milestone tracking, pre-purchasing, and photo updates so you always know where every job stands.',
      abilityToScale: 'One contact. One process. Designed to grow with your portfolio without losing quality or communication.',
    },
    scopeOfWork: 'Flooring, paint, ceilings, drywall, doors, lighting, kitchens, baths, hallways, lobbies, amenity spaces, roofing, siding, parking lots, exterior paint, signage, fencing, pressure washing, hardscape.',
    emailSequence: {
      cold: { day: 1, subject: 'Who handles your unit turns in [City]?', goal: 'Earn a 20-minute conversation' },
      followUp1: { day: 4, subject: 'Re: [Previous] — one thing I forgot to mention', goal: 'Highlight software-based pricing' },
      followUp2: { day: 9, subject: 'Quick question, [First Name]', goal: 'Two questions to qualify fit' },
      breakup: { day: 16, subject: 'Closing the loop, [First Name]', goal: 'Final touch, leave door open' },
    },
    discoveryQuestions: [
      'How many properties are you currently managing, and what\'s the rough unit count?',
      'What does your current renovation program look like — continuous turns or project-based?',
      'Do you have a primary contractor or is it a mix of vendors?',
      'When you think about your renovation program, what frustrates you most consistently?',
      'Have you had projects come in over budget or behind schedule recently?',
      'If you could change one thing about how your construction program runs, what would it be?',
    ],
  },
  hospitality: {
    vertical: 'Hospitality',
    tagline: 'Full-Scope Hospitality Construction | PIP Specialists | Eastern USA',
    idealClient: 'Hotel owners/operators with 3+ properties, 50+ keys, branded flags, active PIP obligations, Eastern USA',
    painPoints: [
      'PIP came in over budget because contractor didn\'t scope to brand standards upfront',
      'Out-of-order rooms sitting down longer than planned — costing real RevPAR',
      'Renovation that failed brand inspection and had to be redone',
      'No single vendor who owns the outcome from guestrooms to grounds',
    ],
    threeUniques: {
      clearCost: 'PIP-accurate, software-based pricing scoped to your flag\'s exact brand standards. Real budgets before a single room goes out of service.',
      clearSchedule: 'Floor-by-floor sequencing, pre-purchased materials, daily photo updates. Minimize out-of-order room count and protect RevPAR.',
      abilityToScale: 'One point of contact manages your full renovation pipeline. Consistent quality across every flag, every property.',
    },
    scopeOfWork: 'Guestroom PIPs, corridors, lobbies, F&B spaces, fitness centers, meeting rooms, back-of-house, exterior facade, porte-cochère, parking, pool deck, roofing, signage, fencing.',
    emailSequence: {
      cold: { day: 1, subject: 'Who\'s handling your PIP work at [Property]?', goal: 'Speak to PIP compliance, RevPAR loss, brand risk' },
      followUp1: { day: 4, subject: 'Re: [Previous] — the PIP piece specifically', goal: 'Highlight PIP-accurate pricing to brand standards' },
      followUp2: { day: 9, subject: 'Two quick questions, [First Name]', goal: 'Qualify: primary contractor? happy with current program?' },
      breakup: { day: 16, subject: 'Closing the loop, [First Name]', goal: 'PIP compliance risk, out-of-order room costs' },
    },
    discoveryQuestions: [
      'How many properties are you operating, and what brands are you flagged under?',
      'Do you have active PIP obligations — what\'s the timeline pressure from the brand?',
      'What does your renovation program typically look like — full guestroom PIPs, selective capital work, or both?',
      'When you think about your last major renovation, what would you have done differently?',
      'Have you had a PIP come in over budget, or a project that dragged out longer than planned?',
      'Have you ever had work fail a brand inspection or require reinspection?',
    ],
  },
  senior_living: {
    vertical: 'Senior Living',
    tagline: 'Full-Scope Commercial Construction | Senior Living Specialists | Eastern USA',
    idealClient: 'Senior living owners/operators with multiple communities, AL/IL/MC, capital improvement programs, Eastern USA',
    painPoints: [
      'Renovations that disrupt resident daily life and create safety concerns',
      'Budget overruns on capital improvement programs across multiple communities',
      'Difficulty finding contractors who understand healthcare/senior living compliance',
      'Fragmented vendor management across a portfolio of communities',
    ],
    threeUniques: {
      clearCost: 'Software-based pricing with line-item specificity. Real budgets that ownership and investors can count on.',
      clearSchedule: 'Phased renovations designed to minimize resident disruption. Milestone tracking and daily updates.',
      abilityToScale: 'One point of contact for your entire portfolio. Consistent quality and communication at every community.',
    },
    scopeOfWork: 'Common areas, dining rooms, resident rooms, corridors, lobbies, activity spaces, exterior facade, parking, landscaping, roofing, signage, ADA compliance upgrades.',
    emailSequence: {
      cold: { day: 1, subject: 'Who handles your capital improvement work?', goal: 'Earn a 20-minute conversation' },
      followUp1: { day: 4, subject: 'Re: [Previous] — the resident disruption piece', goal: 'Highlight phased renovation approach' },
      followUp2: { day: 9, subject: 'Quick question, [First Name]', goal: 'Qualify: primary contractor? portfolio renovation plans?' },
      breakup: { day: 16, subject: 'Closing the loop, [First Name]', goal: 'Final touch, leave door open' },
    },
    discoveryQuestions: [
      'How many communities are you currently operating?',
      'What does your capital improvement program look like this year?',
      'How do you currently handle renovations while keeping residents safe and comfortable?',
      'Do you have a primary contractor or is it spread across multiple vendors?',
      'What\'s the biggest challenge in your renovation program right now?',
    ],
  },
}

export type Vertical = keyof typeof PLAYBOOKS

// Build context string from CRM data for AI prompts
export function buildContactContext(contact: any, org: any, activities: any[], deal?: any): string {
  let context = ''

  if (contact) {
    context += `CONTACT: ${contact.first_name} ${contact.last_name}`
    if (contact.title) context += `, ${contact.title}`
    if (contact.is_decision_maker) context += ' (Decision Maker)'
    if (contact.email) context += `\nEmail: ${contact.email}`
    if (contact.phone) context += `\nPhone: ${contact.phone}`
    if (contact.preferred_channel) context += `\nPreferred channel: ${contact.preferred_channel}`
    if (contact.notes) context += `\nNotes: ${contact.notes}`
    context += '\n\n'
  }

  if (org) {
    context += `ORGANIZATION: ${org.name}`
    if (org.vertical) context += ` (${org.vertical.replace('_', ' ')})`
    if (org.hq_city || org.hq_state) context += `\nLocation: ${[org.hq_city, org.hq_state].filter(Boolean).join(', ')}`
    if (org.portfolio_size) context += `\nPortfolio: ${org.portfolio_size} properties`
    if (org.priority_rating) context += `\nPriority: ${org.priority_rating}`
    if (org.fit_rationale) context += `\nFit rationale: ${org.fit_rationale}`
    if (org.notes) context += `\nOrg notes: ${org.notes}`
    context += '\n\n'
  }

  if (deal) {
    context += `DEAL: ${deal.name}`
    context += `\nStage: ${deal.stage}`
    if (deal.value) context += `\nValue: $${Number(deal.value).toLocaleString()}`
    if (deal.services_offered) context += `\nServices: ${deal.services_offered}`
    if (deal.message_theme) context += `\nMessage theme: ${deal.message_theme}`
    if (deal.expected_close) context += `\nExpected close: ${deal.expected_close}`
    if (deal.notes) context += `\nDeal notes: ${deal.notes}`
    context += '\n\n'
  }

  if (activities && activities.length > 0) {
    context += `ACTIVITY HISTORY (most recent first):\n`
    activities.slice(0, 10).forEach(a => {
      const date = new Date(a.occurred_at).toLocaleDateString()
      context += `- ${date}: ${a.type}${a.direction ? ` (${a.direction})` : ''}${a.subject ? ` — ${a.subject}` : ''}${a.body ? ` | ${a.body.substring(0, 100)}` : ''}\n`
    })
    context += '\n'
  }

  return context
}
