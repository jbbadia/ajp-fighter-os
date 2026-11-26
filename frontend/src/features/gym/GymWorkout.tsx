import { useEffect, useState } from 'react'
import { Check, CheckCircle2, ClipboardList, Dumbbell, Play, Plus, SkipForward, Square, Timer, X } from 'lucide-react'
import type { TrainingSession } from '@/types/domain'
import { sessionStore, useExercises, useProfile, useRoutines } from '@/data'
import type { NextSuggestion } from '@/domain/gymStats'
import { clearanceWarning } from '@/domain/recovery'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, ScaleInput, Select, Textarea } from '@/components/ui/form'
import { Alert, EmptyState } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { fmt, todayISO } from '@/lib/dates'
import { kgToUnit, unitToKg } from '@/lib/units'
import { cn, nowISO, round, uid } from '@/lib/utils'
import { saveDetailedLog } from '@/features/training/logCommon'
import { clock, mmss, useElapsed } from '@/features/training/timer'
import { SuggestionHint, useNextSuggestion } from './progression'
import { planForSession, routinePlan, type PlannedExercise } from './workoutPlan'

interface WSet {
  reps: string
  weight: string
  rir: string
  done: boolean
}
interface WEx {
  id: string
  exerciseId: string
  name: string
  muscleGroup: string
  restSec: number | null
  hint: NextSuggestion | null
  sets: WSet[]
}
interface Draft {
  routineId: string | null
  exercises: WEx[]
  restUntil: number | null
  restFor: number | null
}

/** The workout in progress is kept on the device, so closing the app or locking the phone loses nothing. */
const draftKey = (id: string) => `ajp-fighter-os:workout:${id}`

function loadDraft(id: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') as Draft | null
    return d && Array.isArray(d.exercises) ? d : null
  } catch {
    return null
  }
}

const num = (v: string) => Number(v.replace(',', '.').trim())

/**
 * Guided gym session: the exercises in order with the proposed sets, reps, load and rest;
 * tick each set as you do it (a rest countdown starts), then save it as the session log.
 */
export function GymWorkout({
  session,
  onClose,
  onLogManually,
}: {
  session: TrainingSession
  onClose: () => void
  onLogManually: (session: TrainingSession) => void
}) {
  const profile = useProfile()
  const routines = useRoutines()
  const exercises = useExercises()
  const suggest = useNextSuggestion()
  const toast = useToast()
  const unit = profile.settings.weightUnit
  const allowedUpper = profile.shoulder.loadsAuthorized
  const started = session.status === 'in_progress'
  const elapsed = useElapsed(session.startedAt)
  const warning = clearanceWarning(session.requiresClearance, profile.shoulder)

  const build = (items: PlannedExercise[]): WEx[] =>
    items.map(({ exercise, target, restSec }) => {
      const hint = suggest(exercise.id, target, { before: todayISO(), excludeId: session.id })
      const w = hint?.weightKg ?? target.weightKg
      const rir = hint?.rir ?? target.rir
      return {
        id: uid(),
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        restSec,
        hint,
        sets: Array.from({ length: hint?.sets ?? target.sets }, () => ({
          reps: String(hint?.reps ?? target.reps),
          weight: w == null ? '' : String(round(kgToUnit(w, unit), 1)),
          rir: rir == null ? '' : String(rir),
          done: false,
        })),
      }
    })

  const fromSession = (): Draft => {
    const p = planForSession(session, routines, exercises, allowedUpper)
    return { routineId: p.routineId, exercises: build(p.items), restUntil: null, restFor: null }
  }

  const [draft, setDraft] = useState<Draft>(() => loadDraft(session.id) ?? fromSession())
  const [step, setStep] = useState<'plan' | 'finish'>('plan')
  const [duration, setDuration] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started) localStorage.setItem(draftKey(session.id), JSON.stringify(draft))
  }, [draft, started, session.id])

  const chooseRoutine = (id: string) => {
    const r = routines.find((x) => x.id === id)
    setDraft(r ? { routineId: r.id, exercises: build(routinePlan(r, exercises, allowedUpper)), restUntil: null, restFor: null } : fromSession())
  }

  const patchSet = (ei: number, si: number, p: Partial<WSet>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((x, i) => (i === ei ? { ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, ...p } : s)) } : x)),
    }))

  const toggleDone = (ei: number, si: number) => {
    const ex = draft.exercises[ei]
    const nowDone = !ex.sets[si].done
    patchSet(ei, si, { done: nowDone })
    if (nowDone && ex.restSec) setDraft((d) => ({ ...d, restUntil: Date.now() + ex.restSec! * 1000, restFor: ex.restSec }))
  }

  const addSet = (ei: number) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((x, i) => (i === ei ? { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { reps: '', weight: '', rir: '' }), done: false }] } : x)),
    }))

  const removeExercise = (ei: number) => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))

  const start = () => {
    localStorage.setItem(draftKey(session.id), JSON.stringify(draft))
    sessionStore.update(session.id, { status: 'in_progress', startedAt: nowISO() })
  }

  const cancel = () => {
    localStorage.removeItem(draftKey(session.id))
    sessionStore.update(session.id, { status: 'planned', startedAt: null })
    toast('Entrenamiento cancelado')
    onClose()
  }

  const skip = () => {
    localStorage.removeItem(draftKey(session.id))
    sessionStore.update(session.id, { status: 'skipped', startedAt: null })
    toast('Sesión marcada como no realizada')
    onClose()
  }

  const goFinish = () => {
    setDuration(String(session.startedAt ? Math.max(1, Math.round(elapsed / 60)) : session.durationMin))
    setError(null)
    setStep('finish')
  }

  const save = () => {
    const done = draft.exercises.map((x) => ({ ...x, sets: x.sets.filter((s) => s.done) })).filter((x) => x.sets.length > 0)
    if (!done.length) return setError('Marca con ✓ al menos una serie hecha.')
    const maxW = unit === 'kg' ? 500 : 1100
    for (const x of done) {
      for (const s of x.sets) {
        const bad =
          !Number.isFinite(num(s.reps)) || num(s.reps) < 0 || num(s.reps) > 200 ||
          s.weight.trim() === '' || !Number.isFinite(num(s.weight)) || num(s.weight) < 0 || num(s.weight) > maxW ||
          (s.rir.trim() !== '' && (!Number.isFinite(num(s.rir)) || num(s.rir) < 0 || num(s.rir) > 10))
        if (bad) return setError(`Revisa las series de ${x.name}: repeticiones, peso (0 si es sin carga) y RIR (0-10).`)
      }
    }
    const minutes = num(duration)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) return setError('Indica la duración en minutos.')
    if (!rpe) return setError('Indica el RPE de la sesión (1-10).')

    saveDetailedLog(
      session,
      'gym',
      { date: session.date <= todayISO() ? session.date : todayISO(), time: session.time, durationMin: minutes, rpe, notes },
      {
        gym: {
          routineId: draft.routineId,
          exercises: done.map((x) => ({
            id: x.id,
            exerciseId: x.exerciseId,
            name: x.name,
            muscleGroup: x.muscleGroup,
            restSec: x.restSec,
            notes: '',
            sets: x.sets.map((s) => ({ reps: Math.round(num(s.reps)), weightKg: round(unitToKg(num(s.weight), unit), 2), rir: s.rir.trim() === '' ? null : Math.round(num(s.rir)) })),
          })),
        },
      },
      { objective: session.objective },
    )
    localStorage.removeItem(draftKey(session.id))
    toast('Entrenamiento guardado. La próxima sesión ya está calculada.')
    onClose()
  }

  const current = draft.exercises.findIndex((x) => x.sets.some((s) => !s.done))
  const totalSets = draft.exercises.reduce((a, x) => a + x.sets.length, 0)
  const doneSets = draft.exercises.reduce((a, x) => a + x.sets.filter((s) => s.done).length, 0)

  const footer =
    step === 'finish' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('plan')}>Volver</Button>
        <Button onClick={save}><CheckCircle2 /> Guardar entrenamiento</Button>
      </>
    ) : started ? (
      <>
        <Button variant="ghost" onClick={cancel}><X /> Cancelar</Button>
        <Button onClick={goFinish}><Square /> Finalizar</Button>
      </>
    ) : (
      <>
        <Button variant="ghost" className="px-3" aria-label="No realizada" title="No realizada" onClick={skip}>
          <SkipForward /> <span className="hidden sm:inline">No realizada</span>
        </Button>
        <Button variant="secondary" className="px-3" onClick={() => onLogManually(session)}>
          <ClipboardList /> <span className="sm:hidden">Ya hecha</span><span className="hidden sm:inline">Registrar ya hecha</span>
        </Button>
        <Button onClick={start} disabled={!draft.exercises.length}><Play /> Iniciar entreno</Button>
      </>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={`Gimnasio · ${session.objective}`}
      description={`${fmt(session.date, "EEEE d 'de' MMMM")} · ${session.time} · ${draft.exercises.length} ejercicios · ${totalSets} series`}
      footer={footer}
    >
      {step === 'finish' ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {doneSets} de {totalSets} series hechas. Solo se guardan las marcadas con ✓.
          </p>
          <Field label="Duración real (min)" htmlFor="gw-dur">
            <Input id="gw-dur" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label={`Esfuerzo percibido (RPE)${rpe ? ` · ${rpe}` : ''}`}>
            <ScaleInput name="RPE" value={rpe} onChange={setRpe} lowLabel="Muy suave" highLabel="Máximo" />
          </Field>
          <Field label="Observaciones" htmlFor="gw-notes">
            <Textarea id="gw-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, molestias, técnica…" />
          </Field>
          {error && <Alert severity="critical" title="Falta algo">{error}</Alert>}
        </div>
      ) : (
        <div className="space-y-4">
          {warning && <Alert severity="warning" title="Autorización médica pendiente">{warning}</Alert>}
          {!allowedUpper && <p className="text-xs text-muted-foreground">Los ejercicios de tren superior no aparecen hasta que registres la autorización médica.</p>}

          {started ? (
            <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-card px-1 pb-1">
              <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-accent px-4 py-2.5">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-accent-foreground">En curso</p>
                  <p className="font-display text-3xl font-bold tabular">{clock(elapsed)}</p>
                </div>
                <p className="text-sm tabular text-muted-foreground">{doneSets}/{totalSets} series</p>
              </div>
              {draft.restUntil && draft.restFor && (
                <RestTimer
                  key={draft.restUntil}
                  until={draft.restUntil}
                  total={draft.restFor}
                  onEnd={() => setDraft((d) => ({ ...d, restUntil: null, restFor: null }))}
                />
              )}
            </div>
          ) : (
            <Field label="Rutina" htmlFor="gw-routine" hint="Peso y repeticiones calculados a partir de la última vez que hiciste cada ejercicio.">
              <Select id="gw-routine" value={draft.routineId ?? ''} onChange={(e) => chooseRoutine(e.target.value)}>
                <option value="">Plan de la sesión</option>
                {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
          )}

          {draft.exercises.length === 0 ? (
            <EmptyState icon={<Dumbbell />} title="Sin ejercicios" description="Elige una rutina para ver el entrenamiento." />
          ) : (
            <ol className="space-y-3">
              {draft.exercises.map((x, ei) => {
                const finished = x.sets.every((s) => s.done)
                const isCurrent = started && ei === current
                return (
                  <li key={x.id} className={cn('rounded-xl border p-3', isCurrent ? 'border-primary/60 bg-accent/30' : 'border-border', finished && started && 'opacity-70')}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-muted text-[11px] tabular">{ei + 1}</span>
                          {x.name}
                          {finished && started && <Check className="ml-1 inline size-4 text-good" aria-label="Completado" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {x.muscleGroup} · {x.sets.length} series{x.restSec ? ` · descanso ${mmss(x.restSec)}` : ''}
                        </p>
                      </div>
                      {!started && (
                        <Button size="icon" variant="ghost" aria-label={`Quitar ${x.name}`} onClick={() => removeExercise(ei)}><X /></Button>
                      )}
                    </div>
                    {x.hint && (!started || isCurrent) && <SuggestionHint suggestion={x.hint} unit={unit} className="mb-2" />}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-muted-foreground">
                          <th className="w-8 font-medium">Serie</th>
                          <th className="font-medium">Reps</th>
                          <th className="font-medium">Peso ({unit})</th>
                          <th className="font-medium">RIR</th>
                          {started && <th className="w-11" />}
                        </tr>
                      </thead>
                      <tbody>
                        {x.sets.map((s, si) => (
                          <tr key={si} className={cn(s.done && 'text-muted-foreground')}>
                            <td className="tabular">{si + 1}</td>
                            {(['reps', 'weight', 'rir'] as const).map((k) => (
                              <td key={k} className="py-1 pr-1.5">
                                <Input
                                  aria-label={`${x.name} serie ${si + 1} ${k}`}
                                  className={cn('h-10 px-2 text-center', s.done && 'border-good/40')}
                                  inputMode="decimal"
                                  value={s[k]}
                                  onChange={(e) => patchSet(ei, si, { [k]: e.target.value })}
                                />
                              </td>
                            ))}
                            {started && (
                              <td className="py-1">
                                <button
                                  type="button"
                                  aria-label={`${s.done ? 'Desmarcar' : 'Hecha'} serie ${si + 1} de ${x.name}`}
                                  aria-pressed={s.done}
                                  onClick={() => toggleDone(ei, si)}
                                  className={cn(
                                    'flex size-10 items-center justify-center rounded-lg border transition-colors cursor-pointer',
                                    s.done ? 'border-good bg-good text-white' : 'border-input hover:bg-muted',
                                  )}
                                >
                                  <Check className="size-5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => addSet(ei)}><Plus /> Serie</Button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </Dialog>
  )
}

/** Countdown shown after ticking a set; vibrates the phone when the rest is over. */
function RestTimer({ until, total, onEnd }: { until: number; total: number; onEnd: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  useEffect(() => {
    if (left > 0) return
    navigator.vibrate?.([250, 120, 250])
    onEnd()
  }, [left, onEnd])
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-4 py-2" role="timer" aria-live="polite">
      <Timer className="size-4 text-primary" aria-hidden />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Descanso</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${(left / total) * 100}%` }} />
        </div>
      </div>
      <p className="font-display text-2xl font-bold tabular">{mmss(left)}</p>
      <Button size="sm" variant="ghost" onClick={onEnd}>Saltar</Button>
    </div>
  )
}
