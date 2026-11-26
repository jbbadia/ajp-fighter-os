import type { Exercise, Routine, TrainingSession } from '@/types/domain'
import type { NextTarget } from '@/domain/gymStats'

export interface PlannedExercise {
  exercise: Exercise
  target: NextTarget
  restSec: number | null
}

const DEFAULT_TARGET: NextTarget = { sets: 3, reps: 10, rir: 2, weightKg: null }

const allowed = (ex: Exercise | undefined, allowedUpper: boolean): ex is Exercise => !!ex && (!ex.upperBody || allowedUpper)

/** Exercises of a routine, in order, without the ones the shoulder status does not allow. */
export function routinePlan(routine: Routine, exercises: Exercise[], allowedUpper: boolean): PlannedExercise[] {
  return routine.items.flatMap((it) => {
    const ex = exercises.find((e) => e.id === it.exerciseId)
    return allowed(ex, allowedUpper) ? [{ exercise: ex, target: { sets: it.sets, reps: it.reps, rir: it.rir, weightKg: it.weightKg }, restSec: it.restSec }] : []
  })
}

/**
 * What to do in a planned gym session: the routine named in its objective ("Fuerza de tren inferior" → "Tren inferior"),
 * otherwise the exercises listed in its activities (sets/reps taken from the routines that contain them).
 */
export function planForSession(
  session: Pick<TrainingSession, 'objective' | 'activities'>,
  routines: Routine[],
  exercises: Exercise[],
  allowedUpper: boolean,
): { routineId: string | null; items: PlannedExercise[] } {
  const named = routines.find((r) => session.objective.toLowerCase().includes(r.name.toLowerCase()))
  if (named) return { routineId: named.id, items: routinePlan(named, exercises, allowedUpper) }

  const items: PlannedExercise[] = []
  for (const activity of session.activities) {
    const a = activity.toLowerCase().trim()
    const ex = exercises.find((e) => e.name.toLowerCase() === a) ?? exercises.find((e) => e.name.toLowerCase().startsWith(a))
    if (!allowed(ex, allowedUpper) || items.some((i) => i.exercise.id === ex.id)) continue
    const item = routines.flatMap((r) => r.items).find((it) => it.exerciseId === ex.id)
    items.push({
      exercise: ex,
      target: item ? { sets: item.sets, reps: item.reps, rir: item.rir, weightKg: item.weightKg } : DEFAULT_TARGET,
      restSec: item?.restSec ?? 120,
    })
  }
  if (items.length) return { routineId: null, items }
  const first = routines[0]
  return first ? { routineId: first.id, items: routinePlan(first, exercises, allowedUpper) } : { routineId: null, items: [] }
}
