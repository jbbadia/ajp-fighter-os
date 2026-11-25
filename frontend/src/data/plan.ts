import type { ISODate, ShoulderStatus } from '@/types/domain'
import { generatePlannedSessions } from '@/domain/planTemplate'
import { sessionStore } from './index'

/**
 * Version of the weekly template. Bump it when the template changes (times, sessions…)
 * so existing users get their future planned sessions regenerated once.
 * v2: academy timetable (classes 19:00–20:30, Friday open mat 19:00, Saturday open mat 10:00).
 */
export const PLAN_VERSION = 2

/**
 * Rebuilds the planned template sessions from `from` onwards with the current template.
 * Completed, skipped, in-progress and athlete-added (unplanned) sessions are never touched.
 * Returns how many sessions were regenerated.
 */
export function replanFutureTemplateSessions(shoulder: ShoulderStatus, from: ISODate): number {
  const future = sessionStore.getSnapshot().filter((s) => s.date >= from && s.status === 'planned' && !s.unplanned)
  if (!future.length) return 0
  const last = future.reduce((m, s) => (s.date > m ? s.date : m), from)
  future.forEach((s) => sessionStore.remove(s.id))
  const fresh = generatePlannedSessions(shoulder, from, last)
  fresh.forEach((s) => sessionStore.create(s))
  return fresh.length
}
