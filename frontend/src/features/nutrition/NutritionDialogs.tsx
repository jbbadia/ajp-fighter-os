import { useState } from 'react'
import { z } from 'zod'
import { Save } from 'lucide-react'
import type { AthleteProfile, NutritionLog, Supplement } from '@/types/domain'
import { nutritionStore, profileStore, supplementStore, useNutrition } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ui/tabs'
import { Field, Input, Switch, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { todayISO } from '@/lib/dates'

const MACROS = [
  ['calories', 'Calorías (kcal)', 0, 10000],
  ['proteinG', 'Proteínas (g)', 0, 600],
  ['carbsG', 'Carbohidratos (g)', 0, 1500],
  ['fatG', 'Grasas (g)', 0, 600],
  ['waterL', 'Agua (L)', 0, 15],
] as const
type MacroKey = (typeof MACROS)[number][0]

const toStrings = (src: Partial<Record<MacroKey, number | null>> | undefined) =>
  Object.fromEntries(MACROS.map(([k]) => [k, src?.[k] == null ? '' : String(src[k])])) as Record<MacroKey, string>

const macroSchema = () =>
  z.object(Object.fromEntries(MACROS.map(([k, l, min, max]) => [k, optionalNumber(l, min, max)])) as Record<MacroKey, ReturnType<typeof optionalNumber>>)

export function NutritionLogDialog({ date: initialDate, onClose }: { date?: string; onClose: () => void }) {
  const all = useNutrition()
  const toast = useToast()
  const [date, setDate] = useState(initialDate ?? todayISO())
  const existing = all.find((n) => n.date === date)
  const [vals, setVals] = useState(() => toStrings(existing))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})

  const changeDate = (d: string) => {
    setDate(d)
    const e = all.find((n) => n.date === d)
    setVals(toStrings(e))
    setNotes(e?.notes ?? '')
  }

  const save = () => {
    const r = validate(
      macroSchema().extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').refine((d) => d <= todayISO(), 'No puedes registrar días futuros') }),
      { ...vals, date },
    )
    if (!r.ok) return setErrors(r.errors)
    const { date: d, ...macros } = r.data
    if (Object.values(macros).every((v) => v === null) && !notes.trim()) return setErrors({ calories: 'Introduce al menos un dato' })
    const data: Omit<NutritionLog, 'id' | 'createdAt' | 'updatedAt'> = { date: d, ...macros, notes: notes.trim() }
    if (existing) nutritionStore.update(existing.id, data)
    else nutritionStore.create(data)
    toast('Registro nutricional guardado')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Registro nutricional"
      description="Introduce los totales del día. Todos los campos son opcionales."
      footer={
        <div className="flex w-full justify-between">
          {existing ? <ConfirmButton variant="ghost" size="sm" title="Eliminar registro" message="Se eliminará el registro de este día." onConfirm={() => { nutritionStore.remove(existing.id); toast('Registro eliminado'); onClose() }} /> : <span />}
          <Button onClick={save}><Save /> {existing ? 'Actualizar' : 'Guardar'}</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="nu-date" error={errors.date} className="col-span-2">
          <Input id="nu-date" type="date" max={todayISO()} value={date} onChange={(e) => changeDate(e.target.value)} />
        </Field>
        {MACROS.map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`nu-${k}`} error={errors[k]}>
            <Input id={`nu-${k}`} inputMode="decimal" value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </Field>
        ))}
        <Field label="Notas" htmlFor="nu-notes" className="col-span-2">
          <Textarea id="nu-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

export function TargetsDialog({ profile, onClose }: { profile: AthleteProfile; onClose: () => void }) {
  const toast = useToast()
  const [vals, setVals] = useState(() => toStrings(profile.nutritionTargets))
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = () => {
    const r = validate(macroSchema(), vals)
    if (!r.ok) return setErrors(r.errors)
    profileStore.update(profile.id, { nutritionTargets: r.data })
    toast('Objetivos nutricionales guardados')
    onClose()
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Objetivos nutricionales"
      description="Configúralos tú o con tu nutricionista. La app no calcula ni recomienda objetivos."
      footer={<Button onClick={save}><Save /> Guardar</Button>}
    >
      <div className="grid grid-cols-2 gap-3">
        {MACROS.map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`tg-${k}`} error={errors[k]}>
            <Input id={`tg-${k}`} inputMode="decimal" value={vals[k]} placeholder="Sin objetivo" onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
    </Dialog>
  )
}

export function SupplementDialog({ supplement, onClose }: { supplement: Supplement | null; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: supplement?.name ?? '',
    dose: supplement ? String(supplement.dose) : '',
    unit: supplement?.unit ?? 'g',
    times: supplement?.times.join(', ') ?? '',
    notes: supplement?.notes ?? '',
    active: supplement?.active ?? true,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = () => {
    const times = f.times.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)
    const r = validate(
      z.object({
        name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
        dose: requiredNumber('Dosis', 0, 100000),
        unit: z.string().trim().min(1, 'Indica la unidad').max(15),
        times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:mm, separadas por comas')),
      }),
      { ...f, times },
    )
    if (!r.ok) {
      const t = Object.entries(r.errors).find(([k]) => k.startsWith('times'))?.[1]
      return setErrors({ ...r.errors, times: t ?? '' })
    }
    const data = { name: r.data.name, dose: r.data.dose, unit: r.data.unit, times: [...new Set(times)].sort(), notes: f.notes.trim(), active: f.active }
    if (supplement) supplementStore.update(supplement.id, data)
    else supplementStore.create(data)
    toast('Suplemento guardado')
    onClose()
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={supplement ? 'Editar suplemento' : 'Nuevo suplemento'}
      description="Registra la pauta que sigues. La app no recomienda suplementos ni dosis."
      footer={
        <div className="flex w-full justify-between">
          {supplement ? <ConfirmButton variant="ghost" size="sm" title="Eliminar suplemento" message="Se eliminará el suplemento. Las tomas ya registradas se conservan." onConfirm={() => { supplementStore.remove(supplement.id); toast('Suplemento eliminado'); onClose() }} /> : <span />}
          <Button onClick={save}><Save /> Guardar</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="su-name" error={errors.name} className="col-span-2">
          <Input id="su-name" list="su-names" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <datalist id="su-names">
            {['Creatina', 'Proteína whey', 'Magnesio', 'Multivitamínico'].map((n) => <option key={n} value={n} />)}
          </datalist>
        </Field>
        <Field label="Dosis" htmlFor="su-dose" error={errors.dose}>
          <Input id="su-dose" inputMode="decimal" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
        </Field>
        <Field label="Unidad" htmlFor="su-unit" error={errors.unit}>
          <Input id="su-unit" list="su-units" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <datalist id="su-units">{['g', 'mg', 'cápsulas', 'comprimidos', 'cacitos', 'ml'].map((u) => <option key={u} value={u} />)}</datalist>
        </Field>
        <Field label="Horarios" htmlFor="su-times" hint="Ej.: 08:00, 21:30" error={errors.times || undefined} className="col-span-2">
          <Input id="su-times" value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} />
        </Field>
        <Field label="Notas" htmlFor="su-notes" className="col-span-2">
          <Textarea id="su-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Marca, indicaciones de tu profesional…" />
        </Field>
        <div className="col-span-2">
          <Switch id="su-active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Activo" description="Aparece en la lista de tomas de hoy." />
        </div>
      </div>
    </Dialog>
  )
}
