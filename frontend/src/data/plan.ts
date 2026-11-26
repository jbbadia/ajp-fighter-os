import type { ISODate, ShoulderStatus, TrainingSession } from '@/types/domain'
import { generatePlannedSessions } from '@/domain/planTemplate'
import { sessionStore } from './index'

/**
 * Version of the weekly template. Bump it when the template changes (times, sessions…)
 * so existing users get their future planned sessions regenerated once.
 * v2: academy timetable (classes 19:00–20:30, Friday open mat 19:00, Saturday open mat 10:00).
 * v3: gym at 20:30 after BJJ; fixed ids so two synced devices generate the same sessions.
 * v4: gym and cardio at 21:00 (30 min rest after the 19:00–20:30 class); the gym always goes last.
 */
export const PLAN_VERSION = 4

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
  // A day where that session was already done (or skipped/started) does not get it again.
  const handled = new Set(sessionStore.getSnapshot().filter((s) => s.status !== 'planned').map((s) => `${s.date}|${s.type}`))
  const fresh = generatePlannedSessions(shoulder, from, last).filter((s) => !handled.has(`${s.date}|${s.type}`))
  fresh.forEach((s) => sessionStore.create(s))
  return fresh.length
}

const isTemplatePlan = (s: TrainingSession) => s.status === 'planned' && !s.unplanned && !s.startedAt && !s.result

/**
 * Removes repeated copies of the same planned session (same day, time, type and objective),
 * e.g. when two devices had generated the plan on their own before syncing.
 * Every device keeps the same copy, so they agree after syncing. Returns how many were removed.
 */
export function removeDuplicatePlannedSessions(): number {
  const rank = (s: TrainingSession) => `${s.id.startsWith('tpl-') ? 0 : 1}|${s.createdAt}|${s.id}`
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const s of sessionStore.getSnapshot().filter(isTemplatePlan).sort((a, b) => rank(a).localeCompare(rank(b)))) {
    const key = `${s.date}|${s.time}|${s.type}|${s.objective}`
    if (seen.has(key)) dupes.push(s.id)
    else seen.add(key)
  }
  dupes.forEach((id) => sessionStore.remove(id))
  return dupes.length
}
