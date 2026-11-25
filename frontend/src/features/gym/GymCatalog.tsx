import { useState } from 'react'
import { z } from 'zod'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import type { Exercise, Routine, RoutineItem } from '@/types/domain'
import { exerciseStore, routineStore, useExercises, useProfile, useRoutines } from '@/data'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmButton } from '@/components/ui/tabs'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import { Badge, EmptyState } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { kgToUnit, unitToKg } from '@/lib/units'
import { round } from '@/lib/utils'
import { Dumbbell, ListChecks } from 'lucide-react'

/* ───────────── Exercises ───────────── */

export function ExerciseCatalog() {
  const exercises = useExercises()
  const profile = useProfile()
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const groups = [...new Set(exercises.map((e) => e.muscleGroup))].sort()

  return (
    <Card>
      <CardHeader
        title="Ejercicios"
        description="Los de tren superior requieren autorización médica para cargas."
        icon={<Dumbbell />}
        action={<Button size="sm" onClick={() => setEditing('new')}><Plus /> Nuevo</Button>}
      />
      <CardContent>
        {exercises.length === 0 ? (
          <EmptyState icon={<Dumbbell />} title="Sin ejercicios" />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{g}</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {exercises.filter((e) => e.muscleGroup === g).sort((a, b) => a.name.localeCompare(b.name)).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 cursor-pointer">
                        <span>{e.name}</span>
                        {e.upperBody && (
                          <Badge className={profile.shoulder.loadsAuthorized ? 'bg-muted' : 'bg-warning/15 text-warning'}>
                            <Lock /> {profile.shoulder.loadsAuthorized ? 'Tren superior' : 'Requiere autorización'}
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {editing && <ExerciseDialog exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function ExerciseDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const toast = useToast()
  const routines = useRoutines()
  const [f, setF] = useState({
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? '',
    upperBody: exercise?.upperBody ?? false,
    notes: exercise?.notes ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const usedIn = exercise ? routines.filter((r) => r.items.some((i) => i.exerciseId === exercise.id)) : []

  const save = () => {
    const r = validate(
      z.object({
        name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
        muscleGroup: z.string().trim().min(1, 'Indica el grupo muscular').max(40),
      }),
      f,
    )
    if (!r.ok) return setErrors(r.errors)
    const data = { ...f, name: r.data.name, muscleGroup: r.data.muscleGroup, notes: f.notes.trim() }
    if (exercise) exerciseStore.update(exercise.id, data)
    else exerciseStore.create(data)
    toast('Ejercicio guardado')
    onClose()
  }

  const remove = () => {
    if (!exercise) return
    usedIn.forEach((r) => routineStore.update(r.id, { items: r.items.filter((i) => i.exerciseId !== exercise.id) }))
    exerciseStore.remove(exercise.id)
    toast('Ejercicio eliminado')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      footer={
        <div className="flex w-full justify-between">
          {exercise ? (
            <ConfirmButton
              variant="ghost"
              size="sm"
              title="Eliminar ejercicio"
              message={usedIn.length ? `También se quitará de ${usedIn.length} rutina(s). El historial registrado se conserva.` : 'El historial registrado se conserva.'}
              onConfirm={remove}
            />
          ) : <span />}
          <Button onClick={save}><Save /> Guardar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" htmlFor="ex-name" error={errors.name}>
          <Input id="ex-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Grupo muscular" htmlFor="ex-group" error={errors.muscleGroup}>
          <Input id="ex-group" value={f.muscleGroup} onChange={(e) => setF({ ...f, muscleGroup: e.target.value })} />
        </Field>
        <Switch id="ex-upper" checked={f.upperBody} onChange={(v) => setF({ ...f, upperBody: v })} label="Carga el hombro / tren superior" description="Solo se podrá usar con autorización médica para cargas." />
        <Field label="Observaciones" htmlFor="ex-notes">
          <Textarea id="ex-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  )
}

/* ───────────── Routines ───────────── */

export function RoutineManager() {
  const routines = useRoutines()
  const exercises = useExercises()
  const profile = useProfile()
  const [editing, setEditing] = useState<Routine | 'new' | null>(null)
  const exName = (id: string) => exercises.find((e) => e.id === id)
  return (
    <Card>
      <CardHeader title="Rutinas" description="Plantillas para cargar en tus sesiones" icon={<ListChecks />} action={<Button size="sm" onClick={() => setEditing('new')}><Plus /> Nueva</Button>} />
      <CardContent>
        {routines.length === 0 ? (
          <EmptyState icon={<ListChecks />} title="Sin rutinas" description="Crea tu primera rutina personalizada." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {routines.map((r) => {
              const locked = r.items.some((i) => exName(i.exerciseId)?.upperBody) && !profile.shoulder.loadsAuthorized
              return (
                <button key={r.id} type="button" onClick={() => setEditing(r)} className="rounded-xl border border-border p-3 text-left hover:border-primary/40 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{r.name}</p>
                    {locked && <Lock className="size-4 shrink-0 text-warning" aria-label="Incluye ejercicios sin autorización" />}
                  </div>
                  {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.items.map((i) => `${exName(i.exerciseId)?.name ?? '¿?'} ${i.sets}×${i.reps}`).join(' · ')}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
      {editing && <RoutineDialog routine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

type ItemForm = { exerciseId: string; sets: string; reps: string; weight: string; rir: string; restSec: string; notes: string }

function RoutineDialog({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
  const exercises = useExercises()
  const profile = useProfile()
  const toast = useToast()
  const unit = profile.settings.weightUnit
  const s = (v: number | null) => (v == null ? '' : String(v))
  const [name, setName] = useState(routine?.name ?? '')
  const [description, setDescription] = useState(routine?.description ?? '')
  const [items, setItems] = useState<ItemForm[]>(
    routine?.items.map((i) => ({
      exerciseId: i.exerciseId, sets: String(i.sets), reps: String(i.reps),
      weight: i.weightKg == null ? '' : String(round(kgToUnit(i.weightKg, unit), 1)),
      rir: s(i.rir), restSec: s(i.restSec), notes: i.notes,
    })) ?? [],
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const patch = (i: number, p: Partial<ItemForm>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)))

  const save = () => {
    const schema = z.object({
      name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
      items: z.array(z.object({
        exerciseId: z.string().min(1, 'Elige un ejercicio'),
        sets: requiredNumber('Series', 1, 20),
        reps: requiredNumber('Repeticiones', 1, 100),
        weight: optionalNumber('Peso', 0, unit === 'kg' ? 500 : 1100),
        rir: optionalNumber('RIR', 0, 10),
        restSec: optionalNumber('Descanso', 0, 900),
      })).min(1, 'Añade al menos un ejercicio'),
    })
    const r = validate(schema, { name, items })
    if (!r.ok) return setErrors(r.errors)
    const data = {
      name: r.data.name,
      description: description.trim(),
      items: r.data.items.map((it, i): RoutineItem => ({
        exerciseId: it.exerciseId, sets: Math.round(it.sets), reps: Math.round(it.reps),
        weightKg: it.weight === null ? null : round(unitToKg(it.weight, unit), 2),
        rir: it.rir, restSec: it.restSec, notes: items[i].notes.trim(),
      })),
    }
    if (routine) routineStore.update(routine.id, data)
    else routineStore.create(data)
    toast('Rutina guardada')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={routine ? 'Editar rutina' : 'Nueva rutina'}
      footer={
        <div className="flex w-full justify-between">
          {routine ? <ConfirmButton variant="ghost" size="sm" title="Eliminar rutina" message={`Se eliminará «${routine.name}».`} onConfirm={() => { routineStore.remove(routine.id); toast('Rutina eliminada'); onClose() }} /> : <span />}
          <Button onClick={save}><Save /> Guardar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" htmlFor="ro-name" error={errors.name}>
          <Input id="ro-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descripción" htmlFor="ro-desc">
          <Input id="ro-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {errors.items && <p role="alert" className="text-xs text-critical">{errors.items}</p>}
        <div className="space-y-2">
          {items.map((it, i) => {
            const ex = exercises.find((e) => e.id === it.exerciseId)
            const rowError = Object.entries(errors).find(([k]) => k.startsWith(`items.${i}.`))?.[1]
            return (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Select aria-label="Ejercicio" value={it.exerciseId} onChange={(e) => patch(i, { exerciseId: e.target.value })}>
                    <option value="">Elige un ejercicio…</option>
                    {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}{e.upperBody ? ' (tren superior)' : ''}</option>)}
                  </Select>
                  <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {([['sets', 'Series'], ['reps', 'Reps'], ['weight', `Peso (${unit})`], ['rir', 'RIR'], ['restSec', 'Desc. (s)']] as const).map(([k, l]) => (
                    <Field key={k} label={l} htmlFor={`ro-${i}-${k}`}>
                      <Input id={`ro-${i}-${k}`} className="h-9" inputMode="decimal" value={it[k]} onChange={(e) => patch(i, { [k]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                {ex?.upperBody && !profile.shoulder.loadsAuthorized && (
                  <p className="mt-2 text-xs text-warning">Ejercicio de tren superior: no podrá registrarse hasta tener autorización médica.</p>
                )}
                {rowError && <p role="alert" className="mt-1 text-xs text-critical">{rowError}</p>}
              </div>
            )
          })}
        </div>
        <Button variant="secondary" onClick={() => setItems((xs) => [...xs, { exerciseId: '', sets: '3', reps: '10', weight: '', rir: '2', restSec: '120', notes: '' }])}>
          <Plus /> Añadir ejercicio
        </Button>
      </div>
    </Dialog>
  )
}
