import type { TrainingSession } from '@/types/domain'
import { fmt, lastWeekKeys, weekKey } from '@/lib/dates'
import { round, sum } from '@/lib/utils'

const gymDone = (sessions: TrainingSession[]) =>
  sessions.filter((s) => s.status === 'completed' && s.gym?.exercises.length).sort((a, b) => a.date.localeCompare(b.date))

/** Epley estimate. Only computed for sets of ≤ 12 reps, where it is reasonably meaningful. */
export function estimated1RM(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12 || weightKg <= 0) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export interface ExercisePoint {
  date: string
  label: string
  topWeight: number
  topReps: number
  e1rm: number | null
  volume: number
}

export function exerciseHistory(sessions: TrainingSession[], exerciseId: string): ExercisePoint[] {
  return gymDone(sessions).flatMap((s) => {
    const logs = s.gym!.exercises.filter((e) => e.exerciseId === exerciseId)
    const sets = logs.flatMap((l) => l.sets).filter((x) => x.reps > 0)
    if (!sets.length) return []
    const top = sets.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a))
    const e1rms = sets.map((x) => estimated1RM(x.weightKg, x.reps)).filter((v): v is number => v !== null)
    return [
      {
        date: s.date,
        label: fmt(s.date, 'd MMM'),
        topWeight: top.weightKg,
        topReps: top.reps,
        e1rm: e1rms.length ? round(Math.max(...e1rms), 1) : null,
        volume: round(sum(sets.map((x) => x.reps * x.weightKg)), 0),
      },
    ]
  })
}

export interface PersonalRecord {
  exerciseId: string
  name: string
  maxWeight: number
  repsAtMax: number
  date: string
  bestE1rm: number | null
}

export function personalRecords(sessions: TrainingSession[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>()
  for (const s of gymDone(sessions)) {
    for (const ex of s.gym!.exercises) {
      for (const set of ex.sets) {
        if (set.reps <= 0) continue
        const e1 = estimated1RM(set.weightKg, set.reps)
        const cur = map.get(ex.exerciseId)
        if (!cur) {
          map.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: ex.name, maxWeight: set.weightKg, repsAtMax: set.reps, date: s.date, bestE1rm: e1 })
          continue
        }
        if (set.weightKg > cur.maxWeight || (set.weightKg === cur.maxWeight && set.reps > cur.repsAtMax)) {
          Object.assign(cur, { maxWeight: set.weightKg, repsAtMax: set.reps, date: s.date })
        }
        if (e1 !== null && (cur.bestE1rm === null || e1 > cur.bestE1rm)) cur.bestE1rm = e1
      }
    }
  }
  return [...map.values()].map((r) => ({ ...r, bestE1rm: r.bestE1rm === null ? null : round(r.bestE1rm, 1) })).sort((a, b) => a.name.localeCompare(b.name))
}

/** Weekly tonnage (Σ reps × kg). */
export function weeklyVolume(sessions: TrainingSession[], weeks = 8) {
  const keys = lastWeekKeys(weeks)
  const m = new Map(keys.map((k) => [k, 0]))
  for (const s of gymDone(sessions)) {
    const k = weekKey(s.date)
    if (!m.has(k)) continue
    m.set(k, m.get(k)! + sum(s.gym!.exercises.flatMap((e) => e.sets.map((x) => x.reps * x.weightKg))))
  }
  return keys.map((k) => ({ week: k, label: fmt(k, 'd MMM'), value: round(m.get(k)!, 0) }))
}

export function loggedExerciseIds(sessions: TrainingSession[]): string[] {
  return [...new Set(gymDone(sessions).flatMap((s) => s.gym!.exercises.map((e) => e.exerciseId)))]
}
