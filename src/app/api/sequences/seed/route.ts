import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PLAYBOOK_SEQUENCES = [
  {
    name: 'Multifamily — Cold Email Sequence',
    vertical: 'multifamily',
    description: '4-step cold email sequence for multifamily asset managers and property owners.',
    steps: [
      { step_number: 1, channel: 'email', delay_days: 0,
        subject: 'Who handles your unit turns in {city}?',
        body: `Hi {first_name},

I'll keep this short.

We're ONE70 Group — a full-scope commercial contractor that works exclusively with multifamily asset managers and property owners on common area renovations, unit turns, and capital improvement programs.

Most of the owners we talk to are dealing with the same three things:
- Change orders that blow up their budgets mid-project
- Contractors who go quiet once the job starts
- Schedules that slip, slowing unit turns and costing them revenue

We built our process specifically to eliminate all three.

If you're currently managing renovation work across multiple properties, I'd love to show you how we price and run jobs — no pitch, just a 20-minute walkthrough.

Worth a quick call?

{your_name}
ONE70 Group` },
      { step_number: 2, channel: 'email', delay_days: 4,
        subject: 'Re: Who handles your unit turns — one thing I forgot to mention',
        body: `Hi {first_name},

Following up on my note from earlier this week.

One thing I didn't mention: we use software-based pricing that produces an itemized scope document before a single subcontractor sets foot on site. That means you have a real budget — not a contractor's best guess — that you can take directly to ownership for approval.

For asset managers overseeing multiple properties, this alone eliminates most of the change order surprises that make renovation programs so stressful.

Happy to walk you through exactly how it works. 20 minutes, no pressure.

{your_name}
ONE70 Group` },
      { step_number: 3, channel: 'email', delay_days: 9,
        subject: 'Quick question, {first_name}',
        body: `Hi {first_name},

Two quick questions:
- Do you currently have a primary contractor managing your common area scope, or is it spread across multiple vendors?
- Are you happy with how your current renovation program is running, or is there friction you'd like to solve?

Either way, I'm not trying to pull you away from anyone. I just want to understand whether there's a fit.

If it makes sense, I'd love 20 minutes to show you how we work. If not, no hard feelings.

{your_name}
ONE70 Group` },
      { step_number: 4, channel: 'email', delay_days: 16,
        subject: 'Closing the loop, {first_name}',
        body: `Hi {first_name},

I've reached out a few times and haven't heard back — totally understand, inboxes are brutal.

I'll stop following up after this. But if renovation timelines, change order surprises, or managing multiple vendors across your properties ever become a priority to solve, we'd love to show you a better way to run it.

ONE70 Group works exclusively with multifamily portfolios on full-scope common area programs. Clear pricing. Real schedules. One point of contact.

Feel free to reach out whenever the time is right.

{your_name}
ONE70 Group` },
    ],
  },
  {
    name: 'Hotel — PIP Cold Email Sequence',
    vertical: 'hospitality',
    description: '4-step cold email sequence for hotel owners and operators with PIP obligations.',
    steps: [
      { step_number: 1, channel: 'email', delay_days: 0,
        subject: "Who's handling your PIP work at {property_name}?",
        body: `Hi {first_name},

I'll be direct.

We're ONE70 Group — a full-scope commercial contractor that works exclusively with hotel owners and operators on PIP renovations, capital improvement programs, and property upgrades.

Most of the hotel owners we talk to are dealing with at least one of these:
- A PIP that came in over budget because the contractor didn't scope to brand standards upfront
- Out-of-order rooms sitting down longer than planned — costing real RevPAR
- A renovation that failed brand inspection and had to be redone
- No single vendor who owns the outcome from guestrooms to grounds

We built our process specifically to eliminate all four.

If you have PIP obligations or capital work coming up, I'd love to show you how we price and run hotel renovations — no pitch, just a 20-minute walkthrough.

Worth a quick call?

{your_name}
ONE70 Group` },
      { step_number: 2, channel: 'email', delay_days: 4,
        subject: 'Re: PIP work — the pricing piece specifically',
        body: `Hi {first_name},

Following up from earlier this week — wanted to add one specific point.

We price every PIP renovation using structured, software-based scoping that's built to your flag's exact brand standards. That means you get an itemized budget — mapped line-by-line to your PIP requirements — before a single room goes out of service.

For hotel owners managing PIP obligations, this alone removes most of the budget risk and gives you a defensible number to take to ownership or lenders.

Happy to walk you through exactly how it works on a 20-minute call. No obligation.

{your_name}
ONE70 Group` },
      { step_number: 3, channel: 'email', delay_days: 9,
        subject: 'Two quick questions, {first_name}',
        body: `Hi {first_name},

Two questions — either answer helps me understand if we're worth talking about:
- Do you have a primary contractor managing your PIP and capital work, or is it spread across multiple vendors?
- Are you happy with how your current renovation program is running, or is there specific friction you'd like to solve?

Not trying to pull you away from anyone — just want to know if there's a fit.

If there is, I'd love 20 minutes. If not, I'll leave you alone.

{your_name}
ONE70 Group` },
      { step_number: 4, channel: 'email', delay_days: 16,
        subject: 'Closing the loop, {first_name}',
        body: `Hi {first_name},

I've reached out a few times without hearing back — totally understand, inboxes are brutal and the hospitality calendar never slows down.

This is my last note. But if PIP compliance risk, out-of-order room costs, or managing multiple renovation vendors across your properties ever becomes a priority to solve, we'd love to show you a better way to run it.

ONE70 Group works exclusively with hotel owners on full-scope renovation programs. PIP-accurate pricing. Room-block-minimizing schedules. One point of contact.

Reach out whenever the timing is right.

{your_name}
ONE70 Group` },
    ],
  },
  {
    name: 'Senior Living — Cold Email Sequence',
    vertical: 'senior_living',
    description: '4-step cold email sequence for senior living community owners and operators.',
    steps: [
      { step_number: 1, channel: 'email', delay_days: 0,
        subject: 'Quick question about your renovation program, {first_name}',
        body: `Hi {first_name},

I'll keep this brief.

We're ONE70 Group — a full-scope commercial contractor that works with senior living owners and operators on community renovations, capital improvement programs, and common area upgrades.

Most senior living operators we talk to share the same concerns:
- Renovations that disrupt resident daily routines and create safety risks
- Contractors who don't understand the operational sensitivity of a living community
- Budgets that shift mid-project because the scope wasn't nailed down upfront
- No single point of accountability across dining halls, corridors, units, and exteriors

We phase every renovation around your community's daily schedule — resident comfort is never compromised.

If you have capital work or community upgrades in the pipeline, I'd love to show you how we plan and run these projects. 20 minutes, no pitch.

Worth a quick call?

{your_name}
ONE70 Group` },
      { step_number: 2, channel: 'email', delay_days: 4,
        subject: 'Re: Your renovation program — one thing worth knowing',
        body: `Hi {first_name},

Following up from earlier this week.

One thing that sets us apart for senior living communities: we use software-based pricing with line-item specificity so you get a real budget before any work begins. No change orders mid-project, no surprises for ownership or your board.

More importantly, we phase every job around mealtimes, activity schedules, and resident routines. Your community keeps running normally while we work.

Happy to show you exactly how we do it. 20 minutes, no obligation.

{your_name}
ONE70 Group` },
      { step_number: 3, channel: 'email', delay_days: 9,
        subject: 'Quick question, {first_name}',
        body: `Hi {first_name},

Two quick questions:
- Do you have a primary contractor managing your community renovation work, or do you coordinate multiple vendors?
- What's the biggest operational headache your renovation projects create for your staff and residents?

The answer usually tells us in 30 seconds whether there's a fit.

{your_name}
ONE70 Group` },
      { step_number: 4, channel: 'email', delay_days: 16,
        subject: 'Closing the loop, {first_name}',
        body: `Hi {first_name},

Last note from me. If resident disruption during renovations, budget surprises, or managing multiple vendors across your communities ever becomes a priority to solve, we'd love to show you a better approach.

ONE70 Group works with senior living operators on full-scope renovation programs. Clear pricing. Phased schedules that protect resident routines. One point of contact.

Reach out whenever the timing is right.

{your_name}
ONE70 Group` },
    ],
  },
  {
    name: 'Multifamily — LinkedIn Sequence',
    vertical: 'multifamily',
    description: '3-step LinkedIn message sequence for multifamily contacts.',
    steps: [
      { step_number: 1, channel: 'linkedin', delay_days: 0, subject: '',
        body: `{first_name} — I work with multifamily asset managers on common area renovation programs across the Eastern US. Thought it was worth connecting. — {your_name}, ONE70 Group` },
      { step_number: 2, channel: 'linkedin', delay_days: 1, subject: '',
        body: `Thanks for connecting, {first_name}. We specialize in full-scope commercial construction for multifamily portfolios — everything from flooring and paint to roofing, parking lots, and exterior work. What makes us different is we use software-based pricing so you get an itemized budget upfront and a milestone-driven schedule so jobs don't drift. If renovation programs are on your plate right now, happy to chat for 20 minutes.` },
      { step_number: 3, channel: 'linkedin', delay_days: 5, subject: '',
        body: `Hi {first_name} — quick follow-up. One question: when you think about your current renovation vendor(s), what's the one thing you wish worked better? Asking because the answer usually tells us immediately whether we'd be a good fit.` },
    ],
  },
  {
    name: 'Hotel — LinkedIn Sequence',
    vertical: 'hospitality',
    description: '3-step LinkedIn message sequence for hotel owners and operators.',
    steps: [
      { step_number: 1, channel: 'linkedin', delay_days: 0, subject: '',
        body: `{first_name} — I work with hotel owners on PIP renovations and capital improvement programs across the Eastern US. Thought it was worth connecting. — {your_name}, ONE70 Group` },
      { step_number: 2, channel: 'linkedin', delay_days: 1, subject: '',
        body: `Thanks for connecting, {first_name}. We specialize in full-scope construction for hotel properties — guestroom PIPs, corridors, lobbies, F&B spaces, exteriors, and everything in between. What sets us apart is we price to your flag's exact brand standards upfront, and we sequence work floor-by-floor to minimize out-of-order inventory and protect RevPAR. If you have PIP obligations or capital work in the pipeline, happy to connect for 20 minutes.` },
      { step_number: 3, channel: 'linkedin', delay_days: 5, subject: '',
        body: `Hi {first_name} — quick follow-up. One question: when you think about your current renovation contractor(s), what's the one thing you wish worked better — pricing accuracy, schedule predictability, communication, or something else? The answer usually tells us in about 30 seconds whether we'd be a good fit.` },
    ],
  },
]

export async function POST() {
  const supabase = await createClient()

  // Admin-only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let created = 0
  for (const seq of PLAYBOOK_SEQUENCES) {
    // Check if already exists
    const { data: existing } = await supabase.from('sequences')
      .select('id').eq('name', seq.name).is('deleted_at', null).single()

    if (existing) continue

    const { data: newSeq, error: seqErr } = await supabase.from('sequences').insert({
      name: seq.name,
      vertical: seq.vertical,
      description: seq.description,
      is_system: true,
      is_active: true,
    }).select('id').single()

    if (seqErr || !newSeq) continue

    await supabase.from('sequence_steps').insert(
      seq.steps.map(s => ({
        sequence_id: newSeq.id,
        step_number: s.step_number,
        channel: s.channel,
        delay_days: s.delay_days,
        subject: s.subject || null,
        body: s.body,
      }))
    )
    created++
  }

  return NextResponse.redirect(new URL('/sequences', process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.one70group.com'))
}
