/**
 * Get current time in a specific IANA timezone.
 * Use this server-side instead of new Date().getHours() which returns UTC on Vercel.
 */
export function nowInTimezone(timezone: string = 'America/New_York') {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''

  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hours: parseInt(get('hour')),
    minutes: parseInt(get('minute')),
    seconds: parseInt(get('second')),
    weekday: get('weekday'),
    /** HH:MM format for quiet hours comparison */
    timeString: `${get('hour')}:${get('minute')}`,
    /** YYYY-MM-DD for date comparisons */
    dateString: `${get('year')}-${get('month')}-${get('day')}`,
    /** Day index: 0=Sunday */
    dayOfWeek: now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'narrow' }) === 'S'
      ? (get('weekday') === 'Sunday' ? 0 : 6)
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(get('weekday')) + 1,
  }
}

/**
 * Get today's date string in user's timezone (YYYY-MM-DD)
 */
export function todayInTimezone(timezone: string = 'America/New_York'): string {
  return nowInTimezone(timezone).dateString
}

/**
 * Get tomorrow's date string in user's timezone (YYYY-MM-DD)
 */
export function tomorrowInTimezone(timezone: string = 'America/New_York'): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(tomorrow)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Format a timestamp for display in a specific timezone.
 * Use this server-side instead of new Date(ts).toLocaleString() which uses UTC on Vercel.
 */
export function formatInTimezone(
  timestamp: string | Date,
  timezone: string = 'America/New_York',
  options: { dateOnly?: boolean; timeOnly?: boolean } = {}
): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  if (isNaN(date.getTime())) return ''

  if (options.timeOnly) {
    return date.toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' })
  }
  if (options.dateOnly) {
    return date.toLocaleDateString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' })
  }
  return date.toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
