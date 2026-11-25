import { useState } from 'react'
import { z } from 'zod'
import type { DailyLog, ShoulderMobility } from '@/types/domain'
import { dailyLogStore, useDailyLogs, useProfile } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, ScaleInput, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, validate, type FieldErrors } from '@/lib/validation'
import { kgToUnit, unitToKg } from '@/lib/units'
import { round } from '@/lib/utils'
import { todayISO } from '@/lib/dates'

type Scales = Pick<DailyLog, 'sleepQuality' | 'fatigue' | 'stress' | 'soreness' | 'wellbeing' | 'shoulderPain'>

const SCALES: { key: keyof Scales; label: string; low: string; high: string; min?: number }[] = [
  { key: 'sleepQuality', label: 'Calidad del sueño', low: 'Muy mala', high: 'Excelente' },
  { key: 'fatigue', label: 'Fatiga', low: 'Fresco', high: 'Agotado' },
  { key: 'soreness', label: 'Dolor muscular', low: 'Nada', high: 'Muy intenso' },
  { key: 'stress', label: 'Estrés', low: 'Ninguno', high: 'Muy alto' },
  { key: 'wellbeing', label: 'Estado general', low: 'Muy malo', high: 'Excelente' },
  { key: 'shoulderPain', label: 'Dolor de hombro', low: 'Sin dolor', high: 'Máximo', min: 0 },
]

export function CheckInDialog({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: string }) {
  return open ? <CheckInForm onClose={onClose} initialDate={initialDate} /> : null
}

function CheckInForm({ onClose, initialDate }: { onClose: () => void; initialDate?: string }) {
  const profile = useProfile()
  const logs = useDailyLogs()
  const toast = useToast()
  const unit = profile.settings.weightUnit

  const [date, setDate] = useState(initialDate ?? todayISO())
  const existing = logs.find((l) => l.date === date)

  const fromLog = (l?: DailyLog) => ({
    text: {
      weight: l?.weightKg != null ? String(round(kgToUnit(l.weightKg, unit), 1)) : '',
      sleepHours: l?.sleepHours != null ? String(l.sleepHours) : '',
      restingHr: l?.restingHr != null ? String(l.restingHr) : '',
    },
    scales: {
      sleepQuality: l?.sleepQuality ?? null,
      fatigue: l?.fatigue ?? null,
      stress: l?.stress ?? null,
      soreness: l?.soreness ?? null,
      wellbeing: l?.wellbeing ?? null,
      shoulderPain: l?.shoulderPain ?? null,
    } as Scales,
    mobility: (l?.shoulderMobility ?? '') as ShoulderMobility | '',
    notes: l?.notes ?? '',
  })

  const [form, setForm] = useState(() => fromLog(existing))
  const [errors, setErrors] = useState<FieldErrors>({})

  const changeDate = (d: string) => {
    setDate(d)
    setForm(fromLog(logs.find((l) => l.date === d)))
    setErrors({})
  }

  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').refine((d) => d <= todayISO(), 'No puedes registrar días futuros'),
    weight: optionalNumber('Peso', unit === 'kg' ? 30 : 66, unit === 'kg' ? 200 : 440),
    sleepHours: optionalNumber('Horas de sueño', 0, 16),
    restingHr: optionalNumber('FC en reposo', 25, 140),
  })

  const save = () => {
    const r = validate(schema, { date, ...form.text })
    if (!r.ok) return setErrors(r.errors)
    const data = {
      date: r.data.date,
      weightKg: r.data.weight === null ? null : round(unitToKg(r.data.weight, unit), 2),
      sleepHours: r.data.sleepHours,
      restingHr: r.data.restingHr,
      ...form.scales,
      shoulderMobility: form.mobility || null,
      notes: form.notes.trim(),
    }
    if (existing) dailyLogStore.update(existing.id, data)
    else dailyLogStore.create(data)
    toast(existing ? 'Check-in actualizado' : 'Check-in guardado')
    onClose()
  }

  const setText = (k: keyof typeof form.text, v: string) => setForm((f) => ({ ...f, text: { ...f.text, [k]: v } }))

  return (
    <Dialog
      open
      onClose={onClose}
      title="Check-in diario"
      description="Todos los campos son opcionales. Registra solo lo que conozcas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{existing ? 'Actualizar' : 'Guardar'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="ci-date" error={errors.date} className="col-span-2 sm:col-span-1">
            <Input id="ci-date" type="date" max={todayISO()} value={date} onChange={(e) => changeDate(e.target.value)} />
          </Field>
          <Field label={`Peso en ayunas (${unit})`} htmlFor="ci-weight" error={errors.weight}>
            <Input id="ci-weight" inputMode="decimal" value={form.text.weight} onChange={(e) => setText('weight', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Horas de sueño" htmlFor="ci-sleep" error={errors.sleepHours}>
            <Input id="ci-sleep" inputMode="decimal" value={form.text.sleepHours} onChange={(e) => setText('sleepHours', e.target.value)} placeholder="—" />
          </Field>
          <Field label="FC en reposo (lpm)" htmlFor="ci-hr" error={errors.restingHr} hint="Si la conoces">
            <Input id="ci-hr" inputMode="numeric" value={form.text.restingHr} onChange={(e) => setText('restingHr', e.target.value)} placeholder="—" />
          </Field>
        </div>

        {SCALES.map((s) => (
          <Field key={s.key} label={`${s.label}${form.scales[s.key] !== null ? ` · ${form.scales[s.key]}` : ''}`}>
            <ScaleInput
              name={s.label}
              min={s.min ?? 1}
              value={form.scales[s.key]}
              onChange={(v) => setForm((f) => ({ ...f, scales: { ...f.scales, [s.key]: v } }))}
              lowLabel={s.low}
              highLabel={s.high}
            />
          </Field>
        ))}

        <Field label="Movilidad del hombro" htmlFor="ci-mob">
          <Select id="ci-mob" value={form.mobility} onChange={(e) => setForm((f) => ({ ...f, mobility: e.target.value as ShoulderMobility | '' }))}>
            <option value="">Sin registrar</option>
            <option value="normal">Normal</option>
            <option value="limited">Limitada</option>
            <option value="very_limited">Muy limitada</option>
          </Select>
        </Field>

        <Field label="Notas" htmlFor="ci-notes">
          <Textarea id="ci-notes" value={form.notes} maxLength={1000} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          Esta información sirve para ajustar la carga de entrenamiento. No sustituye la valoración de un profesional sanitario.
        </p>
      </div>
    </Dialog>
  )
}
