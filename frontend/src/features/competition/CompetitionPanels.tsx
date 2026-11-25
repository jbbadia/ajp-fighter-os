import { useState } from 'react'
import { z } from 'zod'
import { CheckSquare, ChevronLeft, ChevronRight, Flag, Pencil, Plus, RotateCcw, Save, Target, Trash2 } from 'lucide-react'
import type { AthleteProfile, PrepPhase, WeeklyGoal } from '@/types/domain'
import { goalStore, profileStore, useDailyLogs, useGoals, useSessions } from '@/data'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { Badge, EmptyState, Progress } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { defaultPhases } from '@/data/seed'
import { GOAL_METRIC_LABEL, goalDone, goalProgress } from '@/domain/analytics'
import { optionalNumber, validate, type FieldErrors } from '@/lib/validation'
import { addDays, fmt, fromISODate, todayISO, toISODate, weekKey } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'

/* ───────────── Phases ───────────── */

export function PhasesCard({ profile }: { profile: AthleteProfile }) {
  const [editing, setEditing] = useState(false)
  const today = todayISO()
  return (
    <Card>
      <CardHeader title="Fases de preparación" icon={<Flag />} action={<Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil /> Editar</Button>} />
      <CardContent>
        <ol className="space-y-2">
          {profile.phases.map((p, i) => {
            const current = today >= p.start && today <= p.end
            const past = today > p.end
            return (
              <li key={p.id} className={cn('rounded-lg border p-3', current ? 'border-primary bg-accent' : 'border-border', past && 'opacity-60')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{i + 1}. {p.name}</p>
                  {current && <Badge className="bg-primary text-primary-foreground">Fase actual</Badge>}
                  {past && <Badge className="bg-muted">Completada</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{fmt(p.start, 'd MMM yyyy')} – {fmt(p.end, 'd MMM yyyy')}</p>
                {p.focus && <p className="mt-1 text-xs text-muted-foreground">{p.focus}</p>}
              </li>
            )
          })}
        </ol>
      </CardContent>
      {editing && <PhasesDialog profile={profile} onClose={() => setEditing(false)} />}
    </Card>
  )
}

function PhasesDialog({ profile, onClose }: { profile: AthleteProfile; onClose: () => void }) {
  const toast = useToast()
  const [phases, setPhases] = useState<PrepPhase[]>(profile.phases)
  const [errors, setErrors] = useState<FieldErrors>({})
  const patch = (i: number, p: Partial<PrepPhase>) => setPhases((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const save = () => {
    const schema = z.array(z.object({ name: z.string().trim().min(1, 'Nombre obligatorio'), start: z.string().min(10, 'Fecha'), end: z.string().min(10, 'Fecha') })
      .refine((p) => p.start <= p.end, { path: ['end'], message: 'El fin debe ser posterior al inicio' }))
      .refine((xs) => xs.every((p, i) => i === 0 || p.start > xs[i - 1].end), { message: 'Las fases no pueden solaparse' })
    const r = validate(schema, phases)
    if (!r.ok) return setErrors(r.errors)
    profileStore.update(profile.id, { phases: phases.map((p) => ({ ...p, name: p.name.trim(), focus: p.focus.trim() })) })
    toast('Fases guardadas')
    onClose()
  }
  return (
    <Dialog open onClose={onClose} className="sm:max-w-2xl" title="Fases de preparación" footer={
      <div className="flex w-full justify-between">
        <Button variant="ghost" size="sm" onClick={() => setPhases(defaultPhases(profile.prepStartDate, profile.competition.date))}><RotateCcw /> Reparto automático</Button>
        <Button onClick={save}><Save /> Guardar</Button>
      </div>
    }>
      <div className="space-y-3">
        {errors[''] && <p role="alert" className="text-xs text-critical">{errors['']}</p>}
        {phases.map((p, i) => (
          <fieldset key={p.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
            <Field label={`Fase ${i + 1}`} htmlFor={`ph-n-${i}`} error={errors[`${i}.name`]} className="col-span-2">
              <Input id={`ph-n-${i}`} value={p.name} onChange={(e) => patch(i, { name: e.target.value })} />
            </Field>
            <Field label="Inicio" htmlFor={`ph-s-${i}`}>
              <Input id={`ph-s-${i}`} type="date" value={p.start} onChange={(e) => patch(i, { start: e.target.value })} />
            </Field>
            <Field label="Fin" htmlFor={`ph-e-${i}`} error={errors[`${i}.end`]}>
              <Input id={`ph-e-${i}`} type="date" value={p.end} onChange={(e) => patch(i, { end: e.target.value })} />
            </Field>
            <Field label="Enfoque" htmlFor={`ph-f-${i}`} className="col-span-2 sm:col-span-4">
              <Input id={`ph-f-${i}`} value={p.focus} onChange={(e) => patch(i, { focus: e.target.value })} />
            </Field>
          </fieldset>
        ))}
      </div>
    </Dialog>
  )
}

/* ───────────── Checklist ───────────── */

export function ChecklistCard({ profile }: { profile: AthleteProfile }) {
  const [text, setText] = useState('')
  const items = profile.checklist
  const set = (checklist: typeof items) => profileStore.update(profile.id, { checklist })
  const done = items.filter((i) => i.done).length
  return (
    <Card>
      <CardHeader title="Checklist de preparación" description={`${done} de ${items.length} completadas`} icon={<CheckSquare />} />
      <CardContent className="space-y-3">
        <Progress value={items.length ? Math.round((done / items.length) * 100) : 0} label="Checklist completada" />
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
              <input
                id={`ck-${it.id}`}
                type="checkbox"
                checked={it.done}
                onChange={() => set(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
                className="size-4 accent-[var(--primary)]"
              />
              <label htmlFor={`ck-${it.id}`} className={cn('flex-1 text-sm cursor-pointer', it.done && 'text-muted-foreground line-through')}>{it.text}</label>
              <button type="button" aria-label={`Eliminar «${it.text}»`} onClick={() => set(items.filter((x) => x.id !== it.id))} className="rounded p-1 text-muted-foreground opacity-0 hover:text-critical group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            set([...items, { id: uid(), text: text.trim().slice(0, 120), done: false }])
            setText('')
          }}
        >
          <Input aria-label="Nueva tarea" placeholder="Añadir tarea…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!text.trim()}><Plus /> Añadir</Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* ───────────── Weekly goals ───────────── */

export function WeeklyGoalsCard() {
  const goals = useGoals()
  const sessions = useSessions()
  const logs = useDailyLogs()
  const toast = useToast()
  const [week, setWeek] = useState(weekKey(todayISO()))
  const [f, setF] = useState({ text: '', metric: '' as WeeklyGoal['metric'] | '', target: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const list = goals.filter((g) => g.week === week)
  const shift = (n: number) => setWeek(toISODate(addDays(fromISODate(week), 7 * n)))

  const add = () => {
    const r = validate(z.object({
      text: z.string().trim().min(1, 'Describe el objetivo').max(120),
      target: f.metric ? optionalNumber('Meta', 1, 10000).refine((v) => v !== null, 'Indica la meta numérica') : z.string(),
    }), f)
    if (!r.ok) return setErrors(r.errors)
    goalStore.create({ week, text: f.text.trim(), metric: f.metric || null, target: f.metric ? Number(f.target.replace(',', '.')) : null, done: false })
    setF({ text: '', metric: '', target: '' })
    setErrors({})
    toast('Objetivo añadido')
  }

  return (
    <Card>
      <CardHeader
        title="Objetivos semanales"
        description={`Semana del ${fmt(week, "d 'de' MMMM")}`}
        icon={<Target />}
        action={
          <div className="flex">
            <Button size="icon" variant="ghost" aria-label="Semana anterior" onClick={() => shift(-1)}><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" aria-label="Semana siguiente" onClick={() => shift(1)}><ChevronRight /></Button>
          </div>
        }
      />
      <CardContent className="space-y-3">
        {list.length === 0 ? (
          <EmptyState icon={<Target />} title="Sin objetivos esta semana" description="Los objetivos con métrica se calculan solos a partir de tus registros." className="py-5" />
        ) : (
          <ul className="space-y-2">
            {list.map((g) => {
              const p = goalProgress(g, sessions, logs)
              const done = goalDone(g, sessions, logs)
              return (
                <li key={g.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    {!g.metric && (
                      <input type="checkbox" aria-label={`Marcar «${g.text}» como cumplido`} checked={g.done} onChange={() => goalStore.update(g.id, { done: !g.done })} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    )}
                    <div className="flex-1">
                      <p className={cn('text-sm', done && 'text-muted-foreground line-through')}>{g.text}</p>
                      {p && (
                        <>
                          <p className="text-xs text-muted-foreground">{GOAL_METRIC_LABEL[g.metric!]}: {p.value.toLocaleString('es-ES')} / {p.target}</p>
                          <Progress className="mt-1.5 h-1.5" value={Math.min(100, Math.round((p.value / p.target) * 100))} label={g.text} />
                        </>
                      )}
                    </div>
                    {done && <Badge className="bg-good/15 text-good">Cumplido</Badge>}
                    <button type="button" aria-label="Eliminar objetivo" onClick={() => goalStore.remove(g.id)} className="rounded p-1 text-muted-foreground hover:text-critical cursor-pointer"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_170px_90px_auto] sm:items-end">
          <Field label="Nuevo objetivo" htmlFor="g-text" error={errors.text}>
            <Input id="g-text" value={f.text} placeholder="Ej.: 4 sesiones de BJJ" onChange={(e) => setF({ ...f, text: e.target.value })} />
          </Field>
          <Field label="Métrica (opcional)" htmlFor="g-metric">
            <Select id="g-metric" value={f.metric ?? ''} onChange={(e) => setF({ ...f, metric: e.target.value as WeeklyGoal['metric'] })}>
              <option value="">Manual</option>
              {Object.entries(GOAL_METRIC_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Meta" htmlFor="g-target" error={errors.target}>
            <Input id="g-target" inputMode="decimal" disabled={!f.metric} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </Field>
          <Button variant="secondary" onClick={add}><Plus /> Añadir</Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ───────────── Competition settings & rules ───────────── */

export function CompetitionSettingsDialog({ profile, onClose }: { profile: AthleteProfile; onClose: () => void }) {
  const toast = useToast()
  const unit = profile.settings.weightUnit
  const [f, setF] = useState({
    name: profile.competition.name,
    date: profile.competition.date,
    dateConfirmed: profile.competition.dateConfirmed,
    weightCategory: profile.competition.weightCategory,
    matchDurationMin: profile.rules.matchDurationMin == null ? '' : String(profile.rules.matchDurationMin),
    weightLimit: profile.rules.weightLimitKg == null ? '' : String(unit === 'kg' ? profile.rules.weightLimitKg : Math.round(profile.rules.weightLimitKg / 0.45359237 * 10) / 10),
    weighInNotes: profile.rules.weighInNotes,
    sourceUrl: profile.rules.sourceUrl,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = () => {
    const r = validate(z.object({
      name: z.string().trim().min(1, 'Nombre obligatorio').max(80),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').refine((d) => d > profile.prepStartDate, 'Debe ser posterior al inicio de la preparación'),
      matchDurationMin: optionalNumber('Duración del combate', 0.5, 30),
      weightLimit: optionalNumber('Límite de peso', 20, 500),
      sourceUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Enlace no válido' })]),
    }), { ...f, sourceUrl: f.sourceUrl.trim() })
    if (!r.ok) return setErrors(r.errors)
    profileStore.update(profile.id, {
      competition: { ...profile.competition, name: r.data.name, date: r.data.date, dateConfirmed: f.dateConfirmed, weightCategory: f.weightCategory.trim() },
      rules: {
        matchDurationMin: r.data.matchDurationMin,
        weightLimitKg: r.data.weightLimit === null ? null : Math.round((unit === 'kg' ? r.data.weightLimit : r.data.weightLimit * 0.45359237) * 100) / 100,
        weighInNotes: f.weighInNotes.trim(),
        sourceUrl: f.sourceUrl.trim(),
      },
    })
    toast('Datos de la competición guardados')
    onClose()
  }
  return (
    <Dialog open onClose={onClose} title="Competición y reglamento" description="Configura estos datos según el reglamento oficial AJP aplicable a tu categoría." footer={<Button onClick={save}><Save /> Guardar</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="cs-n" error={errors.name} className="col-span-2">
          <Input id="cs-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Fecha" htmlFor="cs-d" error={errors.date}>
          <Input id="cs-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="¿Fecha confirmada?" htmlFor="cs-dc">
          <Select id="cs-dc" value={f.dateConfirmed ? 'y' : 'n'} onChange={(e) => setF({ ...f, dateConfirmed: e.target.value === 'y' })}>
            <option value="n">Pendiente (estimada)</option>
            <option value="y">Confirmada</option>
          </Select>
        </Field>
        <Field label="Categoría de peso" htmlFor="cs-c" className="col-span-2">
          <Input id="cs-c" value={f.weightCategory} placeholder="Según reglamento AJP" onChange={(e) => setF({ ...f, weightCategory: e.target.value })} />
        </Field>
        <Field label="Duración del combate (min)" htmlFor="cs-md" error={errors.matchDurationMin}>
          <Input id="cs-md" inputMode="decimal" value={f.matchDurationMin} onChange={(e) => setF({ ...f, matchDurationMin: e.target.value })} />
        </Field>
        <Field label={`Límite de peso (${unit})`} htmlFor="cs-wl" error={errors.weightLimit}>
          <Input id="cs-wl" inputMode="decimal" value={f.weightLimit} onChange={(e) => setF({ ...f, weightLimit: e.target.value })} />
        </Field>
        <Field label="Pesaje (notas)" htmlFor="cs-wn" className="col-span-2" hint="Ej.: con o sin kimono, momento del pesaje…">
          <Textarea id="cs-wn" value={f.weighInNotes} onChange={(e) => setF({ ...f, weighInNotes: e.target.value })} />
        </Field>
        <Field label="Enlace al reglamento oficial" htmlFor="cs-url" error={errors.sourceUrl} className="col-span-2">
          <Input id="cs-url" value={f.sourceUrl} placeholder="https://…" onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  )
}
