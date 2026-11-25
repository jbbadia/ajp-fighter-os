import { useState } from 'react'
import { z } from 'zod'
import type { SessionType, TrainingSession } from '@/types/domain'
import { sessionStore, useSessions } from '@/data'
import { Field, Input, ScaleInput, Textarea } from '@/components/ui/form'
import { requiredNumber, type FieldErrors } from '@/lib/validation'
import { todayISO } from '@/lib/dates'
import { nowISO } from '@/lib/utils'
import type { LogRequest } from './SessionDialogs'

/** Fields shared by every detailed log (BJJ, gym, cardio). */
export interface CommonLog {
  date: string
  time: string
  durationMin: string
  rpe: number | null
  notes: string
}

export const commonSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
    .refine((d) => d <= todayISO(), 'No puedes registrar una sesión futura'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida'),
  durationMin: requiredNumber('Duración', 1, 600),
  rpe: z.number({ error: 'Indica el RPE (1-10)' }).int().min(1).max(10),
})

export function useLogTarget(request: LogRequest) {
  const sessions = useSessions()
  const session = request.sessionId ? sessions.find((s) => s.id === request.sessionId) : undefined
  const initial: CommonLog = {
    date: session?.date && session.date <= todayISO() ? session.date : todayISO(),
    time: session?.time ?? new Date().toTimeString().slice(0, 5),
    durationMin: String(request.durationMin ?? session?.result?.durationMin ?? session?.durationMin ?? 60),
    rpe: session?.result?.rpe ?? null,
    notes: session?.result?.notes ?? '',
  }
  return { session, initial }
}

/** Saves a detailed log: completes the planned session, or creates an unplanned one. */
export function saveDetailedLog(
  session: TrainingSession | undefined,
  type: SessionType,
  common: { date: string; time: string; durationMin: number; rpe: number; notes: string },
  detail: Partial<Pick<TrainingSession, 'bjj' | 'gym' | 'cardio' | 'type'>>,
  defaults: { objective: string },
) {
  const result = {
    durationMin: Math.round(common.durationMin),
    rpe: common.rpe,
    notes: common.notes.trim(),
    completedAt: session?.result?.completedAt ?? nowISO(),
  }
  if (session) {
    return sessionStore.update(session.id, {
      ...detail,
      date: common.date,
      time: common.time,
      status: 'completed',
      startedAt: null,
      result,
    })
  }
  return sessionStore.create({
    date: common.date,
    time: common.time,
    durationMin: Math.round(common.durationMin),
    type,
    intensity: common.rpe >= 8 ? 'high' : common.rpe >= 5 ? 'moderate' : 'low',
    objective: defaults.objective,
    description: '',
    activities: [],
    status: 'completed',
    notes: '',
    unplanned: true,
    requiresClearance: null,
    startedAt: null,
    result,
    ...detail,
  })
}

export function CommonLogFields({
  value,
  onChange,
  errors,
  idPrefix,
}: {
  value: CommonLog
  onChange: (v: CommonLog) => void
  errors: FieldErrors
  idPrefix: string
}) {
  const set = <K extends keyof CommonLog>(k: K, v: CommonLog[K]) => onChange({ ...value, [k]: v })
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha" htmlFor={`${idPrefix}-date`} error={errors.date}>
          <Input id={`${idPrefix}-date`} type="date" max={todayISO()} value={value.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Hora" htmlFor={`${idPrefix}-time`} error={errors.time}>
          <Input id={`${idPrefix}-time`} type="time" value={value.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <Field label="Duración total (min)" htmlFor={`${idPrefix}-dur`} error={errors.durationMin}>
          <Input id={`${idPrefix}-dur`} inputMode="numeric" value={value.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
        </Field>
      </div>
      <Field label={`Intensidad percibida (RPE)${value.rpe ? ` · ${value.rpe}` : ''}`} error={errors.rpe}>
        <ScaleInput name="RPE" value={value.rpe} onChange={(v) => set('rpe', v)} lowLabel="Muy suave" highLabel="Máximo" />
      </Field>
    </>
  )
}

export function NotesField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Field label="Observaciones" htmlFor={id}>
      <Textarea id={id} value={value} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/** Small numeric stepper-friendly input that keeps a string state. */
export function useNumberFields<K extends string>(init: Record<K, number | null>) {
  return useState<Record<K, string>>(
    () => Object.fromEntries(Object.entries(init).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) as Record<K, string>,
  )
}
