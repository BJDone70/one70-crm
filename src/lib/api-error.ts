import { NextResponse } from 'next/server'

/**
 * Helper to create consistent API error responses
 * @param message - Error message to return to client
 * @param status - HTTP status code (default: 400)
 * @returns NextResponse with error object
 */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
