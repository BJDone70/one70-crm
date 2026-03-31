/**
 * Escapes special PostgREST filter characters from user input
 * to prevent filter injection in .or() and .ilike() queries.
 */
export function sanitizeSearchTerm(input: string): string {
  return input.replace(/[%_\\(),."']/g, '')
}
