import type { TrainingSession } from '@/types/domain'
import { daysUntil, fmt } from '@/lib/dates'
import { SESSION_TYPES } from './sessionMeta'

export const isCardio = (s: TrainingSession) => SESSION_TYPES[s.type].discipline === 'cardio' || !!s.cardio

const done = (sessions: TrainingSession[]) =>
  sessions.filter((s) => s.status === 'completed' && isCardio(s)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

export function hrSeries(sessions: TrainingSession[]) {
  return done(sessions)
    .filter((s) => s.cardio?.avgHr != null)
    .map((s) => ({ label: fmt(s.date, 'd MMM'), value: s.cardio!.avgHr! }))
}

export function z2SpeedSeries(sessions: TrainingSession[]) {
  return done(sessions)
    .filter((s) => s.cardio?.kind === 'z2' && s.cardio.speedKmh != null)
    .map((s) => ({ label: fmt(s.date, 'd MMM'), value: s.cardio!.speedKmh! }))
}

export function cardioRpeSeries(sessions: TrainingSession[]) {
  return done(sessions)
    .filter((s) => s.result)
    .map((s) => ({ label: fmt(s.date, 'd MMM'), value: s.result!.rpe }))
}

/** Minutes per HR zone, only from sessions where the athlete logged zone data. */
export function zoneTotals(sessions: TrainingSession[], days = 30) {
  const totals = [0, 0, 0, 0, 0]
  let n = 0
  for (const s of done(sessions)) {
    if (!s.cardio?.zoneMinutes || -daysUntil(s.date) >= days) continue
    n++
    s.cardio.zoneMinutes.forEach((m, i) => (totals[i] += m))
  }
  return { sessions: n, data: totals.map((value, i) => ({ label: `Z${i + 1}`, value })) }
}
