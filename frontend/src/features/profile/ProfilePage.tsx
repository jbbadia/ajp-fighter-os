import { useState, type ReactNode } from 'react'
import { z } from 'zod'
import { Save, ShieldAlert, Trophy, UserRound, Settings2, Target, RotateCcw } from 'lucide-react'
import type { AthleteProfile, Belt, CardioLevel, Modality, ShoulderClearance, Theme, WeightGoal, WeightUnit } from '@/types/domain'
import { profileStore, useProfile } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { BELT_LABEL } from '@/domain/sessionMeta'
import { DataCard } from './DataCard'
import { SyncCard } from './SyncCard'
import { DATA_MODE } from '@/data/adapters'
import { replanFutureTemplateSessions } from '@/data/plan'
import { requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { kgToUnit, unitToKg } from '@/lib/units'
import { cn, round } from '@/lib/utils'
import { addDays, fromISODate, todayISO, toISODate } from '@/lib/dates'

const GOAL_OPTIONS = ['Fuerza', 'Resistencia', 'Explosividad', 'Recuperación', 'Técnica', 'Movilidad', 'Composición corporal']
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')

function toForm(p: AthleteProfile) {
  const u = p.settings.weightUnit
  return {
    name: p.name,
    belt: p.belt,
    currentWeight: String(round(kgToUnit(p.currentWeightKg, u), 1)),
    targetWeight: String(round(kgToUnit(p.targetWeightKg, u), 1)),
    weightGoal: p.weightGoal,
    modalities: p.modalities,
    bjjDaysPerWeek: String(p.bjjDaysPerWeek),
    gymDaysPerWeek: String(p.gymDaysPerWeek),
    cardioLevel: p.cardioLevel,
    mainGoal: p.mainGoal,
    secondaryGoals: p.secondaryGoals,
    compName: p.competition.name,
    compDate: p.competition.date,
    compDateConfirmed: p.competition.dateConfirmed,
    compCategory: p.competition.weightCategory,
    compModalities: p.competition.modalities,
    prepStartDate: p.prepStartDate,
    clearance: p.shoulder.clearance,
    loadsAuthorized: p.shoulder.loadsAuthorized,
    intenseSparringAuthorized: p.shoulder.intenseSparringAuthorized,
    lastReviewDate: p.shoulder.lastReviewDate ?? '',
    shoulderNotes: p.shoulder.notes,
    weightUnit: p.settings.weightUnit,
    theme: p.settings.theme,
    notifications: p.settings.notifications ?? true,
  }
}
type Form = ReturnType<typeof toForm>

const schema = (unit: WeightUnit) => {
  const [min, max] = unit === 'kg' ? [30, 200] : [66, 440]
  return z
    .object({
      name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
      currentWeight: requiredNumber('Peso actual', min, max),
      targetWeight: requiredNumber('Peso objetivo', min, max),
      modalities: z.array(z.string()).min(1, 'Selecciona al menos una modalidad'),
      bjjDaysPerWeek: requiredNumber('Días de BJJ', 0, 7).refine(Number.isInteger, 'Debe ser un número entero'),
      gymDaysPerWeek: requiredNumber('Días de gimnasio', 0, 7).refine(Number.isInteger, 'Debe ser un número entero'),
      mainGoal: z.string().trim().min(1, 'Indica el objetivo principal').max(200),
      compName: z.string().trim().min(1, 'Indica el nombre de la competición').max(80),
      compDate: isoDate,
      compModalities: z.array(z.string()).min(1, 'Selecciona al menos una modalidad'),
      prepStartDate: isoDate,
      lastReviewDate: z.union([z.literal(''), isoDate]),
    })
    .refine((v) => v.prepStartDate < v.compDate, { path: ['prepStartDate'], message: 'Debe ser anterior a la competición' })
}

export function ProfilePage() {
  const profile = useProfile()
  const toast = useToast()
  const [form, setForm] = useState<Form>(() => toForm(profile))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [adaptPlan, setAdaptPlan] = useState(true)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const clearanceChanged =
    form.loadsAuthorized !== profile.shoulder.loadsAuthorized ||
    form.intenseSparringAuthorized !== profile.shoulder.intenseSparringAuthorized

  const changeUnit = (u: WeightUnit) => {
    // Re-express the weight fields in the new unit so the values stay the same.
    const conv = (s: string) => {
      const n = Number(s.replace(',', '.'))
      return Number.isNaN(n) || s === '' ? s : String(round(kgToUnit(unitToKg(n, form.weightUnit), u), 1))
    }
    setForm((f) => ({ ...f, weightUnit: u, currentWeight: conv(f.currentWeight), targetWeight: conv(f.targetWeight) }))
  }

  const save = () => {
    const r = validate(schema(form.weightUnit), form)
    if (!r.ok) {
      setErrors(r.errors)
      toast('Revisa los campos marcados', 'error')
      return
    }
    setErrors({})
    const d = r.data
    const shoulder = {
      clearance: form.clearance,
      loadsAuthorized: form.loadsAuthorized,
      intenseSparringAuthorized: form.intenseSparringAuthorized,
      lastReviewDate: d.lastReviewDate || null,
      notes: form.shoulderNotes.trim(),
    }
    profileStore.update(profile.id, {
      name: d.name,
      belt: form.belt,
      currentWeightKg: round(unitToKg(d.currentWeight, form.weightUnit), 2),
      targetWeightKg: round(unitToKg(d.targetWeight, form.weightUnit), 2),
      weightGoal: form.weightGoal,
      modalities: form.modalities,
      bjjDaysPerWeek: d.bjjDaysPerWeek,
      gymDaysPerWeek: d.gymDaysPerWeek,
      cardioLevel: form.cardioLevel,
      mainGoal: d.mainGoal,
      secondaryGoals: form.secondaryGoals,
      competition: {
        name: d.compName,
        date: d.compDate,
        dateConfirmed: form.compDateConfirmed,
        weightCategory: form.compCategory.trim(),
        modalities: form.compModalities,
      },
      prepStartDate: d.prepStartDate,
      shoulder,
      settings: { weightUnit: form.weightUnit, theme: form.theme, notifications: form.notifications },
    })
    if (clearanceChanged && adaptPlan) {
      const n = replanFutureTemplateSessions(shoulder, toISODate(addDays(fromISODate(todayISO()), 1)))
      toast(`Perfil guardado · ${n} sesiones futuras adaptadas`)
    } else toast('Perfil guardado')
  }

  return (
    <>
      <PageHeader
        title="Perfil"
        description="Datos del deportista, competición, estado del hombro y preferencias."
        actions={
          <>
            <Button variant="ghost" onClick={() => { setForm(toForm(profile)); setErrors({}) }}>
              <RotateCcw /> Descartar
            </Button>
            <Button onClick={save}><Save /> Guardar cambios</Button>
          </>
        }
      />

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); save() }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <Section title="Deportista" icon={<UserRound />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" htmlFor="p-name" error={errors.name} className="col-span-2">
              <Input id="p-name" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Cinturón" htmlFor="p-belt">
              <Select id="p-belt" value={form.belt} onChange={(e) => set('belt', e.target.value as Belt)}>
                {Object.entries(BELT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Nivel cardiovascular" htmlFor="p-cardio">
              <Select id="p-cardio" value={form.cardioLevel} onChange={(e) => set('cardioLevel', e.target.value as CardioLevel)}>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </Select>
            </Field>
            <Field label={`Peso actual (${form.weightUnit})`} htmlFor="p-cw" error={errors.currentWeight} hint="Se usa si no hay registros diarios">
              <Input id="p-cw" inputMode="decimal" value={form.currentWeight} onChange={(e) => set('currentWeight', e.target.value)} aria-invalid={!!errors.currentWeight} />
            </Field>
            <Field label={`Peso objetivo (${form.weightUnit})`} htmlFor="p-tw" error={errors.targetWeight}>
              <Input id="p-tw" inputMode="decimal" value={form.targetWeight} onChange={(e) => set('targetWeight', e.target.value)} aria-invalid={!!errors.targetWeight} />
            </Field>
            <Field label="Objetivo de peso" htmlFor="p-wg" className="col-span-2">
              <Select id="p-wg" value={form.weightGoal} onChange={(e) => set('weightGoal', e.target.value as WeightGoal)}>
                <option value="maintain">Mantener</option>
                <option value="lose">Bajar</option>
                <option value="gain">Subir</option>
              </Select>
            </Field>
            <Field label="Días BJJ / semana" htmlFor="p-bjj" error={errors.bjjDaysPerWeek}>
              <Input id="p-bjj" inputMode="numeric" value={form.bjjDaysPerWeek} onChange={(e) => set('bjjDaysPerWeek', e.target.value)} />
            </Field>
            <Field label="Días gimnasio / semana" htmlFor="p-gym" error={errors.gymDaysPerWeek}>
              <Input id="p-gym" inputMode="numeric" value={form.gymDaysPerWeek} onChange={(e) => set('gymDaysPerWeek', e.target.value)} />
            </Field>
            <Field label="Modalidades que entrenas" error={errors.modalities} className="col-span-2">
              <ModalityPicker value={form.modalities} onChange={(v) => set('modalities', v)} />
            </Field>
          </div>
        </Section>

        <Section title="Objetivos" icon={<Target />}>
          <div className="space-y-3">
            <Field label="Objetivo principal" htmlFor="p-goal" error={errors.mainGoal}>
              <Input id="p-goal" value={form.mainGoal} onChange={(e) => set('mainGoal', e.target.value)} />
            </Field>
            <Field label="Objetivos secundarios">
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <Chip key={g} active={form.secondaryGoals.includes(g)} onClick={() => set('secondaryGoals', toggleIn(form.secondaryGoals, g))}>
                    {g}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Competición" icon={<Trophy />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" htmlFor="p-cn" error={errors.compName} className="col-span-2">
              <Input id="p-cn" value={form.compName} onChange={(e) => set('compName', e.target.value)} />
            </Field>
            <Field label="Fecha" htmlFor="p-cd" error={errors.compDate}>
              <Input id="p-cd" type="date" value={form.compDate} onChange={(e) => set('compDate', e.target.value)} />
            </Field>
            <Field label="Inicio de la preparación" htmlFor="p-ps" error={errors.prepStartDate}>
              <Input id="p-ps" type="date" value={form.prepStartDate} onChange={(e) => set('prepStartDate', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Switch
                id="p-cconf"
                checked={form.compDateConfirmed}
                onChange={(v) => set('compDateConfirmed', v)}
                label="Fecha confirmada"
                description="Desactívalo mientras el día exacto esté pendiente; se mostrará como estimada."
              />
            </div>
            <Field
              label="Categoría de peso"
              htmlFor="p-cat"
              className="col-span-2"
              hint="Configúrala según el reglamento oficial AJP aplicable a tu división. No se asume ningún límite."
            >
              <Input id="p-cat" value={form.compCategory} placeholder="Pendiente de configurar" onChange={(e) => set('compCategory', e.target.value)} />
            </Field>
            <Field label="Modalidades en competición" error={errors.compModalities} className="col-span-2">
              <ModalityPicker value={form.compModalities} onChange={(v) => set('compModalities', v)} />
            </Field>
          </div>
        </Section>

        <Section title="Hombro y autorización médica" icon={<ShieldAlert />}>
          <div className="space-y-3">
            <Alert severity="info" title="Solo un profesional sanitario puede autorizar cargas o sparring intenso">
              Marca estas opciones únicamente cuando cuentes con esa autorización. La aplicación no diagnostica lesiones.
            </Alert>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado de la valoración" htmlFor="p-cl">
                <Select id="p-cl" value={form.clearance} onChange={(e) => set('clearance', e.target.value as ShoulderClearance)}>
                  <option value="pending">Pendiente de valoración</option>
                  <option value="limited">Autorización parcial</option>
                  <option value="full">Autorización completa</option>
                </Select>
              </Field>
              <Field label="Última revisión" htmlFor="p-lr" error={errors.lastReviewDate}>
                <Input id="p-lr" type="date" max={todayISO()} value={form.lastReviewDate} onChange={(e) => set('lastReviewDate', e.target.value)} />
              </Field>
            </div>
            <Switch id="p-loads" checked={form.loadsAuthorized} onChange={(v) => set('loadsAuthorized', v)} label="Cargas de tren superior autorizadas" />
            <Switch id="p-spar" checked={form.intenseSparringAuthorized} onChange={(v) => set('intenseSparringAuthorized', v)} label="Sparring intenso autorizado" />
            {clearanceChanged && (
              <Switch
                id="p-adapt"
                checked={adaptPlan}
                onChange={setAdaptPlan}
                label="Adaptar sesiones futuras planificadas"
                description="Regenera desde mañana las sesiones planificadas de la plantilla según la nueva autorización. Las completadas y las no planificadas no se tocan."
              />
            )}
            <Field label="Notas / pautas del profesional" htmlFor="p-sn">
              <Textarea id="p-sn" value={form.shoulderNotes} maxLength={2000} onChange={(e) => set('shoulderNotes', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Preferencias" icon={<Settings2 />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidad de peso" htmlFor="p-unit">
              <Select id="p-unit" value={form.weightUnit} onChange={(e) => changeUnit(e.target.value as WeightUnit)}>
                <option value="kg">Kilogramos (kg)</option>
                <option value="lb">Libras (lb)</option>
              </Select>
            </Field>
            <Field label="Tema" htmlFor="p-theme">
              <Select id="p-theme" value={form.theme} onChange={(e) => set('theme', e.target.value as Theme)}>
                <option value="dark">Oscuro</option>
                <option value="light">Claro</option>
              </Select>
            </Field>
            <div className="col-span-2">
              <Switch
                id="p-notif"
                checked={form.notifications}
                onChange={(v) => {
                  set('notifications', v)
                  if (v && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
                }}
                label="Notificaciones de sesiones pendientes"
                description="Avisos dentro de la app y, si el navegador lo permite, notificaciones del sistema."
              />
            </div>
          </div>
        </Section>

        {DATA_MODE === 'local' && <SyncCard />}
        <DataCard />

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" size="lg"><Save /> Guardar cambios</Button>
        </div>
      </form>
    </>
  )
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-input text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function ModalityPicker({ value, onChange }: { value: Modality[]; onChange: (v: Modality[]) => void }) {
  const opts: [Modality, string][] = [['gi', 'Gi'], ['nogi', 'No-Gi']]
  return (
    <div className="flex gap-2">
      {opts.map(([m, l]) => (
        <Chip key={m} active={value.includes(m)} onClick={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])}>
          {l}
        </Chip>
      ))}
    </div>
  )
}
