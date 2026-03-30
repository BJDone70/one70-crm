// Default verticals
export const DEFAULT_VERTICALS = [
  { id: 'multifamily', label: 'Multifamily' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'senior_living', label: 'Senior Living' },
]

// Format a vertical ID to a display label
export function formatVerticalLabel(id: string): string {
  const found = DEFAULT_VERTICALS.find(v => v.id === id)
  if (found) return found.label
  // Custom verticals: convert snake_case/lowercase to Title Case
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Color map — known verticals get specific colors, custom get a neutral one
const KNOWN_COLORS: Record<string, string> = {
  multifamily: 'bg-blue-100 text-blue-800',
  hospitality: 'bg-amber-100 text-amber-800',
  senior_living: 'bg-green-100 text-green-800',
}

const CUSTOM_COLORS = [
  'bg-purple-100 text-purple-800',
  'bg-cyan-100 text-cyan-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
  'bg-orange-100 text-orange-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
]

export function getVerticalColor(id: string): string {
  if (KNOWN_COLORS[id]) return KNOWN_COLORS[id]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return CUSTOM_COLORS[Math.abs(hash) % CUSTOM_COLORS.length]
}

const KNOWN_BAR_COLORS: Record<string, string> = {
  multifamily: 'bg-blue-50 text-blue-700',
  hospitality: 'bg-amber-50 text-amber-700',
  senior_living: 'bg-green-50 text-green-700',
}

export function getVerticalBarColor(id: string): string {
  return KNOWN_BAR_COLORS[id] || getVerticalColor(id)
}

// Build full options list including custom verticals from DB
export function buildVerticalOptions(customVerticals: string[]): { id: string; label: string }[] {
  const all = [...DEFAULT_VERTICALS]
  for (const cv of customVerticals) {
    if (!all.some(v => v.id === cv)) {
      all.push({ id: cv, label: formatVerticalLabel(cv) })
    }
  }
  return all
}
