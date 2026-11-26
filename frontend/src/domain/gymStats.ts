import type { SetLog, TrainingSession } from '@/types/domain'
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

/* ───────────────────────── Next-session progression ───────────────────────── */

export type NextAction = 'first' | 'increase' | 'repeat' | 'more_reps' | 'decrease' | 'hold_recovery'

export interface NextTarget {
  sets: number
  reps: number
  rir: number | null
  weightKg: number | null
}

export interface NextSuggestion {
  sets: number
  reps: number
  weightKg: number | null
  rir: number | null
  action: NextAction
  reason: string
  last: { date: string; sets: SetLog[] } | null
}

/** Load jump when every set was completed with margin. Small loads move in smaller steps. */
export function loadIncrement(weightKg: number): number {
  return weightKg >= 20 ? 2.5 : 1
}

const roundHalf = (v: number) => Math.round(v * 2) / 2

/**
 * Double progression driven by the last time the exercise was done:
 * - every target set reached with the planned margin (RIR) → add load;
 * - reached but with less margin than planned → repeat the load;
 * - a few reps short (≤ 2) → repeat the load and complete the reps;
 * - far short → lower the load ~10 %.
 * Bodyweight exercises (0 kg) progress by one rep. Red recovery never adds load.
 */
export function suggestNext(
  sessions: TrainingSession[],
  exerciseId: string,
  target: NextTarget | null,
  opts: { before?: string; excludeId?: string; holdIncrease?: boolean; formatWeight?: (kg: number) => string } = {},
): NextSuggestion | null {
  const fw = opts.formatWeight ?? ((kg: number) => `${kg.toLocaleString('es-ES')} kg`)
  const prev = gymDone(sessions)
    .filter((s) => s.id !== opts.excludeId && (!opts.before || s.date <= opts.before))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((s) => ({ date: s.date, sets: s.gym!.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets).filter((x) => x.reps > 0) }))
    .filter((x) => x.sets.length > 0)
  const last = prev[prev.length - 1]

  if (!last) {
    if (!target) return null
    return {
      sets: target.sets,
      reps: target.reps,
      weightKg: target.weightKg,
      rir: target.rir,
      action: 'first',
      reason: 'Primera vez: elige un peso con el que te queden unas 2 repeticiones en recámara.',
      last: null,
    }
  }

  const w = Math.max(...last.sets.map((x) => x.weightKg))
  const top = last.sets.filter((x) => x.weightKg === w)
  const tReps = target?.reps ?? Math.max(...top.map((x) => x.reps))
  const tSets = target?.sets ?? last.sets.length
  const tRir = target?.rir ?? null
  const minReps = Math.min(...top.map((x) => x.reps))
  const rirs = top.map((x) => x.rir).filter((r): r is number => r !== null)
  const minRir = rirs.length ? Math.min(...rirs) : null
  const completed = top.length >= tSets && minReps >= tReps
  const withMargin = minRir === null || minRir >= (tRir ?? 1)
  const base = { sets: tSets, rir: tRir, last }

  if (w === 0) {
    const reps = Math.max(tReps, minReps)
    return completed && withMargin
      ? { ...base, reps: reps + 1, weightKg: 0, action: 'more_reps', reason: 'Completaste todas las series: suma 1 repetición por serie.' }
      : { ...base, reps, weightKg: 0, action: 'repeat', reason: 'Repite las mismas repeticiones hasta completarlas con margen.' }
  }

  if (completed && withMargin) {
    if (opts.holdIncrease)
      return { ...base, reps: tReps, weightKg: w, action: 'hold_recovery', reason: 'Lo completaste, pero tu recuperación está en rojo: mantén el peso hoy.' }
    const inc = loadIncrement(w)
    return { ...base, reps: tReps, weightKg: w + inc, action: 'increase', reason: `Completaste ${tSets}×${tReps} con margen: sube ${fw(inc)}.` }
  }
  if (completed)
    return { ...base, reps: tReps, weightKg: w, action: 'repeat', reason: `Llegaste muy justo (RIR ${minRir}): repite ${fw(w)} y busca más margen.` }
  if (minReps >= tReps - 2)
    return { ...base, reps: tReps, weightKg: w, action: 'more_reps', reason: `Te faltaron repeticiones (mínimo ${minReps} de ${tReps}): repite el peso y complétalas.` }
  return { ...base, reps: tReps, weightKg: roundHalf(w * 0.9), action: 'decrease', reason: `Te quedaste lejos (mínimo ${minReps} de ${tReps}): baja ~10 % para hacerlas con buena técnica.` }
}
