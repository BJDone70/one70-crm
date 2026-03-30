// Project stage utilities - safe for server components (no 'use client')

export interface ProjectStage {
  id: string
  label: string
  color: string
  sort_order: number
  is_terminal?: boolean // complete, on_hold — stages where projects "stop"
}

export const DEFAULT_PROJECT_STAGES: ProjectStage[] = [
  { id: 'scoping', label: 'Scoping', color: 'bg-purple-100 text-purple-700', sort_order: 0 },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700', sort_order: 1 },
  { id: 'punch_list', label: 'Punch List', color: 'bg-amber-100 text-amber-700', sort_order: 2 },
  { id: 'complete', label: 'Complete', color: 'bg-green-100 text-green-700', sort_order: 3, is_terminal: true },
  { id: 'on_hold', label: 'On Hold', color: 'bg-gray-100 text-gray-600', sort_order: 4, is_terminal: true },
]

export function getStageLabel(stageId: string, stages?: ProjectStage[]): string {
  const list = stages || DEFAULT_PROJECT_STAGES
  const found = list.find(s => s.id === stageId)
  if (found) return found.label
  return stageId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getStageColor(stageId: string, stages?: ProjectStage[]): string {
  const list = stages || DEFAULT_PROJECT_STAGES
  const found = list.find(s => s.id === stageId)
  if (found) return found.color
  return 'bg-gray-100 text-gray-600'
}

export function getNextStage(currentId: string, stages?: ProjectStage[]): ProjectStage | null {
  const list = stages || DEFAULT_PROJECT_STAGES
  const idx = list.findIndex(s => s.id === currentId)
  if (idx < 0 || idx >= list.length - 1) return null
  const next = list[idx + 1]
  if (next?.is_terminal) return null
  return next
}

export function isTerminalStage(stageId: string, stages?: ProjectStage[]): boolean {
  const list = stages || DEFAULT_PROJECT_STAGES
  const found = list.find(s => s.id === stageId)
  return found?.is_terminal || false
}
