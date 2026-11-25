import type { DailyLog, ISODate, TrainingSession, WeeklyGoal } from '@/types/domain'
import { addDays, fmt, fromISODate, lastWeekKeys, toISODate, weekKey } from '@/lib/dates'
import { average, isPresent, round, sum } from '@/lib/utils'
import { SESSION_TYPES } from './sessionMeta'

export interface WeekStats {
  week: ISODate
  label: string
  planned: number
  completed: number
  /** completed / planned (%), null when nothing was planned. */
  compliance: number | null
  bjjMin: number
  giMin: number
  nogiMin: number
  gymMin: number
  cardioMin: number
  totalMin: number
  load: number
  avgRpe: number | null
  gymVolumeKg: number
  avgFatigue: number | null
  avgWellbeing: number | null
  avgSleepH: number | null
  avgWeightKg: number | null
  checkins: number
  goalsTotal: number
  goalsDone: number
}

const minutes = (s: TrainingSession) => s.result?.durationMin ?? s.durationMin

export function weekStats(week: ISODate, sessions: TrainingSession[], logs: DailyLog[], goals: WeeklyGoal[]): WeekStats {
  const end = toISODate(addDays(fromISODate(week), 6))
  const inWeek = sessions.filter((s) => s.date >= week && s.date <= end && s.type !== 'rest')
  const done = inWeek.filter((s) => s.status === 'completed')
  const by = (pred: (s: TrainingSession) => boolean) => sum(done.filter(pred).map(minutes))
  const disc = (s: TrainingSession) => SESSION_TYPES[s.type].discipline
  const wLogs = logs.filter((l) => l.date >= week && l.date <= end)
  const avg = (pick: (l: DailyLog) => number | null, d = 1) => {
    const a = average(wLogs.map(pick).filter(isPresent))
    return a === null ? null : round(a, d)
  }
  const planned = inWeek.filter((s) => !s.unplanned).length
  const plannedDone = inWeek.filter((s) => !s.unplanned && s.status === 'completed').length
  const wGoals = goals.filter((g) => g.week === week)
  const rpes = done.map((s) => s.result?.rpe).filter(isPresent)
  return {
    week,
    label: fmt(week, 'd MMM'),
    planned,
    completed: done.length,
    compliance: planned ? Math.round((plannedDone / planned) * 100) : null,
    bjjMin: by((s) => disc(s) === 'bjj'),
    giMin: by((s) => s.type === 'bjj_gi'),
    nogiMin: by((s) => s.type === 'bjj_nogi'),
    gymMin: by((s) => disc(s) === 'gym'),
    cardioMin: by((s) => disc(s) === 'cardio'),
    totalMin: by(() => true),
    load: sum(done.map((s) => (s.result ? s.result.durationMin * s.result.rpe : 0))),
    avgRpe: rpes.length ? round(average(rpes)!, 1) : null,
    gymVolumeKg: round(sum(done.flatMap((s) => s.gym?.exercises.flatMap((e) => e.sets.map((x) => x.reps * x.weightKg)) ?? [])), 0),
    avgFatigue: avg((l) => l.fatigue),
    avgWellbeing: avg((l) => l.wellbeing),
    avgSleepH: avg((l) => l.sleepHours),
    avgWeightKg: avg((l) => l.weightKg, 2),
    checkins: wLogs.length,
    goalsTotal: wGoals.length,
    goalsDone: wGoals.filter((g) => goalDone(g, sessions, logs)).length,
  }
}

export function weeksStats(count: number, sessions: TrainingSession[], logs: DailyLog[], goals: WeeklyGoal[]) {
  return lastWeekKeys(count).map((w) => weekStats(w, sessions, logs, goals))
}

/** Consecutive weeks (ending last week or this week) with ≥ 80 % compliance. */
export function consistencyStreak(stats: WeekStats[]): number {
  let streak = 0
  for (let i = stats.length - 1; i >= 0; i--) {
    const c = stats[i].compliance
    if (i === stats.length - 1 && (c === null || c < 80)) continue // current week may be in progress
    if (c === null || c < 80) break
    streak++
  }
  return streak
}

/* ───────────── Weekly goals ───────────── */

export const GOAL_METRIC_LABEL = {
  sessions: 'Sesiones completadas',
  bjj_hours: 'Horas de BJJ',
  gym_sessions: 'Sesiones de gimnasio',
  cardio_minutes: 'Minutos de cardio',
  checkins: 'Check-ins diarios',
} as const

export function goalProgress(g: WeeklyGoal, sessions: TrainingSession[], logs: DailyLog[]): { value: number; target: number } | null {
  if (!g.metric || !g.target) return null
  const s = weekStats(g.week, sessions, logs, [])
  const value = {
    sessions: s.completed,
    bjj_hours: round(s.bjjMin / 60, 1),
    gym_sessions: sessions.filter((x) => weekKey(x.date) === g.week && x.status === 'completed' && x.type === 'gym').length,
    cardio_minutes: s.cardioMin,
    checkins: s.checkins,
  }[g.metric]
  return { value, target: g.target }
}

export function goalDone(g: WeeklyGoal, sessions: TrainingSession[], logs: DailyLog[]): boolean {
  const p = goalProgress(g, sessions, logs)
  return p ? p.value >= p.target : g.done
}
