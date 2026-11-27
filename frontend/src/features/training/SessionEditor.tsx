import { useState } from 'react'
import { z } from 'zod'
import { ClipboardList, Copy, Save } from 'lucide-react'
import type { Intensity, SessionStatus, SessionType, SkipReason, TrainingSession } from '@/types/domain'
import { sessionStore, useProfile, useSessions } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ui/tabs'
import { Field, Input, ScaleInput, Select, Textarea } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { hasDetailedLog, INTENSITY_LABEL, SESSION_TYPE_OPTIONS, SKIP_REASONS, STATUS_LABEL } from '@/domain/sessionMeta'
import { clearanceWarning } from '@/domain/recovery'
import { requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { todayISO } from '@/lib/dates'
import { nowISO } from '@/lib/utils'
import { useSessionDialogs } from './SessionDialogs'

const blank = (): Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'> => ({
  date: todayISO(),
  time: '18:00',
  durationMin: 60,
  type: 'bjj_gi',
  intensity: 'moderate',
  objective: '',
  description: '',
  activities: [],
  status: 'planned',
  notes: '',
  unplanned: false,
  requiresClearance: null,
  startedAt: null,
  result: null,
})

export function SessionEditor({
  sessionId,
  defaults,
  onClose,
}: {
  sessionId: string | null
  defaults?: Partial<TrainingSession>
  onClose: () => void
}) {
  const sessions = useSessions()
  const profile = useProfile()
  const toast = useToast()
  const dialogs = useSessionDialogs()
  const existing = sessionId ? sessions.find((s) => s.id === sessionId) : undefined
  const base = existing ?? { ...blank(), ...defaults }

  const [f, setF] = useState({
    date: base.date,
    time: base.time,
    durationMin: String(base.durationMin),
    type: base.type,
    intensity: base.intensity,
    objective: base.objective,
    description: base.description,
    activities: base.activities.join('\n'),
    status: (base.status === 'in_progress' ? 'planned' : base.status) as SessionStatus,
    notes: base.notes,
    actualDuration: String(base.result?.durationMin ?? base.durationMin),
    rpe: base.result?.rpe ?? null,
    skipReason: (base.skipReason ?? '') as SkipReason | '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const isRest = f.type === 'rest'
  const completing = f.status === 'completed'

  const save = () => {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida'),
      durationMin: requiredNumber('Duración', 0, 600),
      objective: z.string().trim().max(120, 'Máximo 120 caracteres'),
      actualDuration: completing && !isRest ? requiredNumber('Duración real', 1, 600) : z.string(),
      rpe: completing && !isRest ? z.number({ error: 'Indica el RPE' }).min(1).max(10) : z.any(),
    }).refine((v) => !(completing && v.date > todayISO()), { path: ['status'], message: 'No puedes completar una sesión futura' })
    const r = validate(schema, f)
    if (!r.ok) return setErrors(r.errors)

    const result =
      completing && !isRest
        ? {
            durationMin: Number(f.actualDuration),
            rpe: f.rpe!,
            notes: existing?.result?.notes ?? '',
            completedAt: existing?.result?.completedAt ?? nowISO(),
          }
        : null
    const data = {
      date: f.date,
      time: f.time,
      durationMin: Math.round(r.data.durationMin),
      type: f.type,
      intensity: f.intensity,
      objective: f.objective.trim(),
      description: f.description.trim(),
      activities: f.activities.split('\n').map((a) => a.trim()).filter(Boolean),
      status: f.status,
      skipReason: f.status === 'skipped' ? f.skipReason || null : null,
      notes: f.notes.trim(),
      result,
      startedAt: null,
    }
    if (existing) sessionStore.update(existing.id, data)
    else sessionStore.create({ ...blank(), ...defaults, ...data })
    toast(existing ? 'Sesión actualizada' : 'Sesión creada')
    onClose()
  }

  const remove = () => {
    if (!existing) return
    sessionStore.remove(existing.id)
    toast('Sesión eliminada')
    onClose()
  }

  const duplicate = () => {
    if (!existing) return
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing
    sessionStore.create({ ...rest, status: 'planned', result: null, startedAt: null, bjj: null, gym: null, cardio: null })
    toast('Sesión duplicada')
    onClose()
  }

  const warning = existing ? clearanceWarning(existing.requiresClearance, profile.shoulder) : null

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? 'Editar sesión' : defaults?.unplanned ? 'Registrar sesión no planificada' : 'Nueva sesión'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {existing && (
              <ConfirmButton variant="ghost" size="sm" title="Eliminar sesión" message="Esta acción no se puede deshacer." onConfirm={remove} />
            )}
            {existing && (
              <Button variant="ghost" size="sm" onClick={duplicate}>
                <Copy /> Duplicar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {existing && hasDetailedLog(existing.type) && (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose()
                  dialogs.log({ sessionId: existing.id, type: existing.type })
                }}
              >
                <ClipboardList /> Registro detallado
              </Button>
            )}
            <Button onClick={save}>
              <Save /> Guardar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {warning && <Alert severity="warning" title="Autorización médica pendiente">{warning}</Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Tipo" htmlFor="se-type" className="col-span-2 sm:col-span-1">
            <Select id="se-type" value={f.type} onChange={(e) => set('type', e.target.value as SessionType)}>
              {SESSION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha" htmlFor="se-date" error={errors.date}>
            <Input id="se-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Hora" htmlFor="se-time" error={errors.time}>
            <Input id="se-time" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
          <Field label="Duración (min)" htmlFor="se-dur" error={errors.durationMin}>
            <Input id="se-dur" inputMode="numeric" value={f.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
          </Field>
          <Field label="Intensidad" htmlFor="se-int">
            <Select id="se-int" value={f.intensity} onChange={(e) => set('intensity', e.target.value as Intensity)}>
              {Object.entries(INTENSITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Estado" htmlFor="se-status" error={errors.status}>
            <Select id="se-status" value={f.status} onChange={(e) => set('status', e.target.value as SessionStatus)}>
              {(['planned', 'completed', 'skipped'] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
          </Field>
          {f.status === 'skipped' && (
            <Field label="Motivo" htmlFor="se-skip">
              <Select id="se-skip" value={f.skipReason} onChange={(e) => set('skipReason', e.target.value as SkipReason | '')}>
                <option value="">Sin indicar</option>
                {SKIP_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          )}
        </div>
        {completing && !isRest && (
          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[140px_1fr]">
            <Field label="Duración real (min)" htmlFor="se-adur" error={errors.actualDuration}>
              <Input id="se-adur" inputMode="numeric" value={f.actualDuration} onChange={(e) => set('actualDuration', e.target.value)} />
            </Field>
            <Field label={`RPE${f.rpe ? ` · ${f.rpe}` : ''}`} error={errors.rpe}>
              <ScaleInput name="RPE" value={f.rpe} onChange={(v) => set('rpe', v)} />
            </Field>
          </div>
        )}
        <Field label="Objetivo" htmlFor="se-obj" error={errors.objective}>
          <Input id="se-obj" value={f.objective} maxLength={120} onChange={(e) => set('objective', e.target.value)} />
        </Field>
        <Field label="Descripción" htmlFor="se-desc">
          <Textarea id="se-desc" value={f.description} maxLength={1000} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Ejercicios / actividades" htmlFor="se-act" hint="Una por línea">
          <Textarea id="se-act" value={f.activities} onChange={(e) => set('activities', e.target.value)} />
        </Field>
        <Field label="Observaciones" htmlFor="se-notes">
          <Textarea id="se-notes" value={f.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}
