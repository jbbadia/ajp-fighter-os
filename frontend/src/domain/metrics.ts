import type { AthleteProfile, DailyLog, ISODate, TrainingSession } from '@/types/domain'
import { daysUntil, fmt, fromISODate, isInWeek, lastWeekKeys, todayISO, weekKey } from '@/lib/dates'
import { average, isPresent, round, sum } from '@/lib/utils'
import { SESSION_TYPES, type Discipline } from './sessionMeta'
import { sortedLogs } from './recovery'

const discipline = (s: TrainingSession): Discipline => SESSION_TYPES[s.type].discipline
const isCompleted = (s: TrainingSession) => s.status === 'completed'
const doneMinutes = (s: TrainingSession) => s.result?.durationMin ?? s.durationMin

/** Training sessions that count toward totals (rest days excluded). */
const isTraining = (s: TrainingSession) => s.type !== 'rest'

export function weekSummary(sessions: TrainingSession[], ref = new Date()) {
  const week = sessions.filter((s) => isInWeek(s.date, ref) && isTraining(s))
  const done = week.filter(isCompleted)
  const minutesBy = (d: Discipline) => sum(done.filter((s) => discipline(s) === d).map(doneMinutes))
  return {
    planned: week.length,
    completed: done.length,
    bjjMin: minutesBy('bjj'),
    gymMin: minutesBy('gym'),
    cardioMin: minutesBy('cardio'),
  }
}

export function totalMinutes(sessions: TrainingSession[], d: Discipline): number {
  return sum(sessions.filter((s) => isCompleted(s) && discipline(s) === d).map(doneMinutes))
}

/** Session-RPE load (duration × RPE), standard internal-load metric. */
export function sessionLoad(s: TrainingSession): number | null {
  return s.result ? s.result.durationMin * s.result.rpe : null
}

export interface WeeklyPoint {
  week: ISODate
  label: string
  value: number
}

export function weeklySeries(
  sessions: TrainingSession[],
  weeks: number,
  value: (s: TrainingSession) => number | null,
  filter: (s: TrainingSession) => boolean = () => true,
): WeeklyPoint[] {
  const keys = lastWeekKeys(weeks)
  const buckets = new Map(keys.map((k) => [k, 0]))
  for (const s of sessions) {
    if (!isCompleted(s) || !filter(s)) continue
    const k = weekKey(s.date)
    const v = value(s)
    if (buckets.has(k) && isPresent(v)) buckets.set(k, buckets.get(k)! + v)
  }
  return keys.map((k) => ({ week: k, label: fmt(k, 'd MMM'), value: buckets.get(k)! }))
}

export const weeklyLoad = (sessions: TrainingSession[], weeks = 8) => weeklySeries(sessions, weeks, sessionLoad)

export const weeklyCardioMinutes = (sessions: TrainingSession[], weeks = 8) =>
  weeklySeries(sessions, weeks, doneMinutes, (s) => discipline(s) === 'cardio')

export function hasAny(points: WeeklyPoint[]) {
  return points.some((p) => p.value > 0)
}

/* ───────────── Weight & daily logs ───────────── */

export function weightSeries(logs: DailyLog[], days = 30) {
  return sortedLogs(logs)
    .filter((l) => isPresent(l.weightKg) && -daysUntil(l.date) < days && daysUntil(l.date) <= 0)
    .map((l) => ({ date: l.date, label: fmt(l.date, 'd MMM'), value: l.weightKg! }))
}

/** Latest logged weight, or the profile reference weight if nothing is logged. */
export function currentWeight(profile: AthleteProfile, logs: DailyLog[]) {
  const withWeight = sortedLogs(logs).filter((l) => isPresent(l.weightKg))
  const last = withWeight[withWeight.length - 1]
  return last
    ? { kg: last.weightKg!, source: 'log' as const, date: last.date }
    : { kg: profile.currentWeightKg, source: 'profile' as const, date: null }
}

export function recentLogs(logs: DailyLog[], days = 7) {
  return sortedLogs(logs).filter((l) => -daysUntil(l.date) < days && daysUntil(l.date) <= 0)
}

export function avgOf(logs: DailyLog[], pick: (l: DailyLog) => number | null) {
  const avg = average(logs.map(pick).filter(isPresent))
  return avg === null ? null : round(avg, 1)
}

/* ───────────── Competition cycle ───────────── */

/**
 * Cycle progress = share of the preparation timeline already elapsed.
 * It is a calendar indicator, not a measure of fitness.
 */
export function cycleProgress(profile: AthleteProfile) {
  const total = Math.max(1, -daysUntil(profile.prepStartDate, fromISODate(profile.competition.date)))
  const elapsed = -daysUntil(profile.prepStartDate)
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  return { pct, daysLeft: daysUntil(profile.competition.date), totalDays: total }
}

/* ───────────── Next session ───────────── */

export function nextSession(sessions: TrainingSession[]): TrainingSession | null {
  const now = new Date()
  const today = todayISO()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const active = sessions.find((s) => s.status === 'in_progress')
  if (active) return active
  return (
    [...sessions]
      .filter((s) => s.status === 'planned' && isTraining(s))
      // today's sessions remain "next" until 2h after their start time
      .filter((s) => s.date > today || (s.date === today && addMinutes(s.time, 120) >= hhmm))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] ?? null
  )
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const t = Math.min(23 * 60 + 59, h * 60 + m + min)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
