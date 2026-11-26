import { useState } from 'react'
import { z } from 'zod'
import { Dumbbell, Lock, Plus, Save, Trash2, X } from 'lucide-react'
import type { Exercise, ExerciseLog } from '@/types/domain'
import { useExercises, useProfile, useRoutines } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { Alert, EmptyState } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { kgToUnit, unitToKg } from '@/lib/units'
import { round, uid } from '@/lib/utils'
import type { LogRequest } from '@/features/training/SessionDialogs'
import type { NextSuggestion, NextTarget } from '@/domain/gymStats'
import { SuggestionHint, useNextSuggestion } from './progression'
import { planForSession, routinePlan, type PlannedExercise } from './workoutPlan'
import { CommonLogFields, NotesField, commonSchema, saveDetailedLog, useLogTarget } from '@/features/training/logCommon'

interface SetForm {
  reps: string
  weight: string
  rir: string
}
interface ExForm {
  id: string
  exerciseId: string
  name: string
  muscleGroup: string
  restSec: string
  notes: string
  sets: SetForm[]
  /** Proposal calculated from the last time this exercise was done (new entries only). */
  hint: NextSuggestion | null
}

export function GymLogDialog({ request, onClose }: { request: LogRequest; onClose: () => void }) {
  const profile = useProfile()
  const exercises = useExercises()
  const routines = useRoutines()
  const toast = useToast()
  const unit = profile.settings.weightUnit
  const allowedUpper = profile.shoulder.loadsAuthorized
  const { session, initial } = useLogTarget(request)
  const suggest = useNextSuggestion()

  const fromLog = (e: ExerciseLog): ExForm => ({
    id: e.id,
    exerciseId: e.exerciseId,
    name: e.name,
    muscleGroup: e.muscleGroup,
    restSec: e.restSec == null ? '' : String(e.restSec),
    notes: e.notes,
    sets: e.sets.map((s) => ({ reps: String(s.reps), weight: String(round(kgToUnit(s.weightKg, unit), 1)), rir: s.rir == null ? '' : String(s.rir) })),
    hint: null,
  })
  const [common, setCommon] = useState(initial)

  /** New exercise entry, pre-filled with the proposal for this session (or the routine target the first time). */
  const fromExercise = (ex: Exercise, target: NextTarget | null, restSec: number | null = 120): ExForm => {
    const hint = suggest(ex.id, target, { before: common.date, excludeId: session?.id })
    const weightKg = hint?.weightKg ?? target?.weightKg ?? null
    const rir = hint?.rir ?? target?.rir ?? 2
    return {
      id: uid(),
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      restSec: restSec == null ? '' : String(restSec),
      notes: '',
      hint,
      sets: Array.from({ length: hint?.sets ?? target?.sets ?? 3 }, () => ({
        reps: String(hint?.reps ?? target?.reps ?? 8),
        weight: weightKg == null ? '' : String(round(kgToUnit(weightKg, unit), 1)),
        rir: rir == null ? '' : String(rir),
      })),
    }
  }

  const exById = (id: string) => exercises.find((e) => e.id === id)
  const blocked = (exId: string) => !!exById(exId)?.upperBody && !allowedUpper

  const fromPlan = (items: PlannedExercise[]) => items.map(({ exercise, target, restSec }) => fromExercise(exercise, target, restSec))
  const routineItems = (id: string): ExForm[] => {
    const r = routines.find((x) => x.id === id)
    return r ? fromPlan(routinePlan(r, exercises, allowedUpper)) : []
  }

  // A planned session opens with its exercises loaded (routine named in the objective, or the listed activities).
  const auto = session?.gym
    ? null
    : request.routineId
      ? { routineId: request.routineId, items: null }
      : session
        ? planForSession(session, routines, exercises, allowedUpper)
        : null
  const [routineId, setRoutineId] = useState<string | null>(session?.gym?.routineId ?? auto?.routineId ?? null)
  const [items, setItems] = useState<ExForm[]>(
    () => session?.gym?.exercises.map(fromLog) ?? (auto ? (auto.items ? fromPlan(auto.items) : routineItems(auto.routineId!)) : []),
  )
  const [adding, setAdding] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const loadRoutine = (id: string) => {
    setRoutineId(id || null)
    const r = routines.find((x) => x.id === id)
    if (!r) return
    setItems(routineItems(id))
    if (r.items.some((it) => blocked(it.exerciseId))) toast('Se han omitido ejercicios de tren superior sin autorización', 'error')
  }

  const addExercise = (id: string) => {
    const ex = exById(id)
    if (!ex || blocked(id)) return
    setItems((xs) => [...xs, fromExercise(ex, null)])
    setAdding('')
  }

  const patch = (id: string, p: Partial<ExForm>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const patchSet = (id: string, i: number, p: Partial<SetForm>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, ...p } : s)) } : x)))

  const save = () => {
    const [wMin, wMax] = unit === 'kg' ? [0, 500] : [0, 1100]
    const schema = commonSchema.extend({
      items: z
        .array(
          z.object({
            restSec: optionalNumber('Descanso', 0, 900),
            sets: z
              .array(
                z.object({
                  reps: requiredNumber('Repeticiones', 0, 200),
                  weight: requiredNumber('Peso', wMin, wMax),
                  rir: optionalNumber('RIR', 0, 10),
                }),
              )
              .min(1, 'Añade al menos una serie'),
          }),
        )
        .min(1, 'Añade al menos un ejercicio'),
    })
    const r = validate(schema, { ...common, items })
    if (!r.ok) {
      setErrors(r.errors)
      toast('Revisa los campos marcados', 'error')
      return
    }
    const d = r.data
    saveDetailedLog(
      session,
      'gym',
      { ...common, durationMin: d.durationMin, rpe: d.rpe },
      {
        gym: {
          routineId,
          exercises: items.map((x, i) => ({
            id: x.id,
            exerciseId: x.exerciseId,
            name: x.name,
            muscleGroup: x.muscleGroup,
            restSec: d.items[i].restSec,
            notes: x.notes.trim(),
            sets: d.items[i].sets.map((s) => ({ reps: Math.round(s.reps), weightKg: round(unitToKg(s.weight, unit), 2), rir: s.rir })),
          })),
        },
      },
      { objective: routines.find((x) => x.id === routineId)?.name ?? 'Sesión de gimnasio no planificada' },
    )
    toast('Sesión de gimnasio guardada')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={session ? 'Registro de gimnasio' : 'Registrar sesión de gimnasio'}
      description={session?.objective}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}><Save /> Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!allowedUpper && (
          <Alert severity="warning" title="Tren superior bloqueado">
            Sin autorización médica registrada para cargas de tren superior. Se habilitará desde el perfil cuando la tengas.
          </Alert>
        )}
        <CommonLogFields value={common} onChange={setCommon} errors={errors} idPrefix="gy" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cargar rutina" htmlFor="gy-routine">
            <Select id="gy-routine" value={routineId ?? ''} onChange={(e) => loadRoutine(e.target.value)}>
              <option value="">— Sin rutina —</option>
              {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Añadir ejercicio" htmlFor="gy-add">
            <Select id="gy-add" value={adding} onChange={(e) => addExercise(e.target.value)}>
              <option value="">Selecciona…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id} disabled={blocked(e.id)}>
                  {e.name} · {e.muscleGroup}{blocked(e.id) ? ' (requiere autorización)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {errors.items && <p role="alert" className="text-xs text-critical">{errors.items}</p>}

        {items.length === 0 ? (
          <EmptyState icon={<Dumbbell />} title="Sin ejercicios" description="Carga una rutina o añade ejercicios uno a uno." />
        ) : (
          <div className="space-y-3">
            {items.map((x, i) => (
              <fieldset key={x.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <legend className="text-sm font-medium">
                    {x.name} <span className="text-xs font-normal text-muted-foreground">· {x.muscleGroup}</span>
                    {blocked(x.exerciseId) && <Lock className="ml-1 inline size-3 text-warning" aria-label="Requiere autorización" />}
                  </legend>
                  <Button size="icon" variant="ghost" aria-label={`Quitar ${x.name}`} onClick={() => setItems((xs) => xs.filter((y) => y.id !== x.id))}>
                    <X />
                  </Button>
                </div>
                {x.hint && <SuggestionHint suggestion={x.hint} unit={unit} className="mb-2" />}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-muted-foreground">
                      <th className="w-10 font-medium">Serie</th>
                      <th className="font-medium">Reps</th>
                      <th className="font-medium">Peso ({unit})</th>
                      <th className="font-medium">RIR</th>
                      <th className="w-9" />
                    </tr>
                  </thead>
                  <tbody>
                    {x.sets.map((s, j) => (
                      <tr key={j}>
                        <td className="tabular text-muted-foreground">{j + 1}</td>
                        {(['reps', 'weight', 'rir'] as const).map((k) => (
                          <td key={k} className="py-1 pr-2">
                            <Input
                              aria-label={`${x.name} serie ${j + 1} ${k}`}
                              aria-invalid={!!errors[`items.${i}.sets.${j}.${k}`]}
                              title={errors[`items.${i}.sets.${j}.${k}`]}
                              className="h-9"
                              inputMode="decimal"
                              value={s[k]}
                              onChange={(e) => patchSet(x.id, j, { [k]: e.target.value })}
                            />
                          </td>
                        ))}
                        <td>
                          <Button size="icon" variant="ghost" aria-label={`Eliminar serie ${j + 1}`} onClick={() => patch(x.id, { sets: x.sets.filter((_, k) => k !== j) })}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {Object.keys(errors).some((k) => k.startsWith(`items.${i}.`)) && (
                  <p role="alert" className="mt-1 text-xs text-critical">
                    {Object.entries(errors).find(([k]) => k.startsWith(`items.${i}.`))?.[1]}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-[auto_120px_1fr] items-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch(x.id, { sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { reps: '', weight: '', rir: '' }) }] })}
                  >
                    <Plus /> Serie
                  </Button>
                  <Field label="Descanso (s)" htmlFor={`gy-rest-${x.id}`}>
                    <Input id={`gy-rest-${x.id}`} className="h-9" inputMode="numeric" value={x.restSec} onChange={(e) => patch(x.id, { restSec: e.target.value })} />
                  </Field>
                  <Field label="Observaciones" htmlFor={`gy-n-${x.id}`}>
                    <Input id={`gy-n-${x.id}`} className="h-9" value={x.notes} onChange={(e) => patch(x.id, { notes: e.target.value })} />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>
        )}
        <NotesField id="gy-notes" value={common.notes} onChange={(v) => setCommon((c) => ({ ...c, notes: v }))} />
      </div>
    </Dialog>
  )
}
