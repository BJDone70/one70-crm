// Simple in-memory rate limiter
// LIMITATION: In serverless environments (Vercel, Netlify, AWS Lambda), each invocation gets a fresh process
// with its own memory space. This means:
// - Rate limit state does NOT persist across requests unless they hit the same container
// - After ~15 minutes of inactivity, containers are recycled and state is lost
// - This is acceptable for application-level rate limiting but NOT for strict DDoS protection
// - For strict enforcement, use a persistent external store (Redis, Supabase, etc)
//
// At current scale, this approach works fine. Monitor for growth/abuse and upgrade if needed.

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
// This prevents memory leaks from accumulating stale entries over time
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000) // Every minute (60,000 ms)

// Ensure cleanup doesn't prevent process exit if it's the only thing keeping the process alive
cleanupInterval.unref?.()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}

// Helpers for common patterns
export function rateLimitByIp(ip: string, limit: number = 10, windowMs: number = 60_000) {
  return rateLimit(`ip:${ip}`, limit, windowMs)
}

export function rateLimitByUser(userId: string, limit: number = 20, windowMs: number = 60_000) {
  return rateLimit(`user:${userId}`, limit, windowMs)
}
