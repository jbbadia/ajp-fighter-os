import { useState } from 'react'
import { Apple, Check, Droplets, Pill, Plus, Scale, Settings2, Target, Undo2 } from 'lucide-react'
import type { NutritionLog, Supplement } from '@/types/domain'
import { intakeStore, useDailyLogs, useIntakes, useNutrition, useProfile, useSupplements } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { Alert, Badge, EmptyState } from '@/components/ui/misc'
import { BarTrend, LineTrend } from '@/components/charts/TrendChart'
import { useToast } from '@/components/ui/toast'
import { weeklyNutrition, weightWithAverage } from '@/domain/nutritionStats'
import { addDays, fmt, fromISODate, todayISO, toISODate } from '@/lib/dates'
import { formatWeight, kgToUnit } from '@/lib/units'
import { cn, round } from '@/lib/utils'
import { NutritionLogDialog, SupplementDialog, TargetsDialog } from './NutritionDialogs'
type Tab = 'nutrition' | 'supplements'
type Range = '30' | '60' | '90'

export function NutritionPage() {
  const [tab, setTab] = useState<Tab>('nutrition')
  return (
    <>
      <PageHeader title="Nutrición" description="Peso, macronutrientes, agua y suplementación." />
      <Tabs className="mb-4" value={tab} onChange={setTab} options={[{ value: 'nutrition', label: 'Nutrición y peso' }, { value: 'supplements', label: 'Suplementos' }]} />
      {tab === 'nutrition' ? <NutritionTab /> : <SupplementsTab />}
    </>
  )
}

function NutritionTab() {
  const profile = useProfile()
  const logs = useDailyLogs()
  const nutrition = useNutrition()
  const unit = profile.settings.weightUnit
  const t = profile.nutritionTargets
  const [range, setRange] = useState<Range>('30')
  const [logDate, setLogDate] = useState<string | null>(null)
  const [targetsOpen, setTargetsOpen] = useState(false)
  const today = nutrition.find((n) => n.date === todayISO())
  const weights = weightWithAverage(logs, Number(range)).map((p) => ({
    ...p,
    value: round(kgToUnit(p.value, unit), 1),
    value2: p.value2 == null ? null : round(kgToUnit(p.value2, unit), 1),
  }))
  const weeks = weeklyNutrition(nutrition, logs)
  const protein = nutrition
    .filter((n) => n.proteinG != null && n.date >= toISODate(addDays(fromISODate(todayISO()), -13)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((n) => ({ label: fmt(n.date, 'd MMM'), value: n.proteinG! }))

  const macroRow: [keyof NutritionLog & keyof typeof t, string, string][] = [
    ['calories', 'Calorías', 'kcal'],
    ['proteinG', 'Proteínas', 'g'],
    ['carbsG', 'Carbohidratos', 'g'],
    ['fatG', 'Grasas', 'g'],
    ['waterL', 'Agua', 'L'],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Hoy"
            icon={<Apple />}
            description={today ? 'Totales registrados' : 'Aún no has registrado la nutrición de hoy'}
            action={
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setTargetsOpen(true)}><Settings2 /> Objetivos</Button>
                <Button size="sm" onClick={() => setLogDate(todayISO())}><Plus /> {today ? 'Editar' : 'Registrar'}</Button>
              </div>
            }
          />
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {macroRow.map(([k, l, u]) => {
              const v = today?.[k] as number | null | undefined
              const target = t[k]
              const pct = v != null && target ? Math.min(100, Math.round((v / target) * 100)) : null
              return (
                <div key={k} className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="tabular text-lg font-semibold">{v != null ? v.toLocaleString('es-ES') : '—'}<span className="ml-1 text-xs text-muted-foreground">{u}</span></p>
                  <p className="text-[11px] text-muted-foreground">{target ? `Objetivo ${target.toLocaleString('es-ES')} ${u}` : 'Sin objetivo'}</p>
                  {pct !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l} respecto al objetivo`}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Peso" icon={<Scale />} description={`Objetivo: ${profile.weightGoal === 'maintain' ? 'mantener' : profile.weightGoal === 'lose' ? 'bajar' : 'subir'} ~${formatWeight(profile.targetWeightKg, unit)}`} />
          <CardContent className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Último registro</p>
              <p className="tabular text-lg font-semibold">{weights.length ? `${weights[weights.length - 1].value.toLocaleString('es-ES')} ${unit}` : '—'}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Media semanal</p>
              <p className="tabular text-lg font-semibold">{weeks[0].weight != null ? formatWeight(weeks[0].weight, unit) : '—'}</p>
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">El peso en ayunas se registra en el check-in diario.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Evolución del peso"
          description="Peso diario en ayunas y media móvil de 7 días (con ≥ 3 pesajes)"
          icon={<Scale />}
          action={<Tabs value={range} onChange={setRange} options={[{ value: '30', label: '30 d' }, { value: '60', label: '60 d' }, { value: '90', label: '90 d' }]} />}
        />
        <CardContent>
          {weights.length >= 2 ? (
            <LineTrend
              height={240}
              data={weights}
              seriesNames={['Peso diario', 'Media 7 días']}
              reference={{ value: round(kgToUnit(profile.targetWeightKg, unit), 1), label: 'Objetivo' }}
              format={(v) => `${v.toLocaleString('es-ES')} ${unit}`}
              ariaLabel={`Peso de los últimos ${range} días`}
            />
          ) : (
            <EmptyState icon={<Scale />} title="Datos insuficientes" description="Registra tu peso en ayunas en al menos 2 check-ins." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Proteínas" description="Últimos 14 días (g)" icon={<Target />} />
          <CardContent>
            {protein.length >= 1 ? (
              <BarTrend data={protein} format={(v) => `${v} g`} reference={t.proteinG ? { value: t.proteinG, label: 'Objetivo' } : undefined} ariaLabel="Proteína diaria de los últimos 14 días" />
            ) : (
              <EmptyState icon={<Target />} title="Sin registros de proteína" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Medias semanales" description="Solo cuentan los días registrados" icon={<Droplets />} />
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  {['Semana', 'Peso', 'kcal', 'Prot.', 'HC', 'Grasa', 'Agua', 'Días'].map((h) => <th key={h} className="pb-2 pr-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-border">
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <td className="py-2 pr-2">{fmt(w.week, 'd MMM')}</td>
                    <td className="pr-2">{w.weight != null ? formatWeight(w.weight, unit, false) : '—'}</td>
                    <td className="pr-2">{w.calories ?? '—'}</td>
                    <td className="pr-2">{w.proteinG ?? '—'}</td>
                    <td className="pr-2">{w.carbsG ?? '—'}</td>
                    <td className="pr-2">{w.fatG ?? '—'}</td>
                    <td className="pr-2">{w.waterL ?? '—'}</td>
                    <td>{w.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historial nutricional" icon={<Apple />} action={<Button size="sm" variant="secondary" onClick={() => setLogDate(todayISO())}><Plus /> Añadir día</Button>} />
        <CardContent>
          {nutrition.length === 0 ? (
            <EmptyState icon={<Apple />} title="Sin registros" description="Registra tus totales diarios de calorías, macros y agua." />
          ) : (
            <ul className="divide-y divide-border">
              {[...nutrition].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => setLogDate(n.date)} className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/40 cursor-pointer sm:px-2">
                    <span className="capitalize">{fmt(n.date, 'EEE d MMM')}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      {[n.calories != null && `${n.calories} kcal`, n.proteinG != null && `P ${n.proteinG} g`, n.carbsG != null && `HC ${n.carbsG} g`, n.fatG != null && `G ${n.fatG} g`, n.waterL != null && `${n.waterL} L`].filter(Boolean).join(' · ') || 'Solo notas'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {logDate && <NutritionLogDialog date={logDate} onClose={() => setLogDate(null)} />}
      {targetsOpen && <TargetsDialog profile={profile} onClose={() => setTargetsOpen(false)} />}    </div>
  )
}

function SupplementsTab() {
  const supplements = useSupplements()
  const intakes = useIntakes()
  const toast = useToast()
  const [editing, setEditing] = useState<Supplement | 'new' | null>(null)
  const today = todayISO()
  const active = supplements.filter((s) => s.active)
  const last14 = Array.from({ length: 14 }, (_, i) => toISODate(addDays(fromISODate(today), -13 + i)))

  const takenAt = (s: Supplement, time: string) => intakes.find((i) => i.supplementId === s.id && i.date === today && i.time === time)
  const toggle = (s: Supplement, time: string) => {
    const existing = takenAt(s, time)
    if (existing) {
      intakeStore.remove(existing.id)
      toast('Toma desmarcada')
    } else {
      intakeStore.create({ supplementId: s.id, date: today, time, dose: s.dose })
      toast(`${s.name} registrado`)
    }
  }

  return (
    <div className="space-y-4">
      <Alert severity="info" title="La app no recomienda suplementos ni dosis">
        Registra únicamente la pauta que sigues por decisión propia o indicada por un profesional.
      </Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tomas de hoy" description={fmt(today, "EEEE d 'de' MMMM")} icon={<Pill />} />
          <CardContent>
            {active.length === 0 ? (
              <EmptyState icon={<Pill />} title="Sin suplementos activos" />
            ) : (
              <ul className="space-y-2">
                {active.flatMap((s) => (s.times.length ? s.times : ['—']).map((time) => {
                  const taken = takenAt(s, time)
                  return (
                    <li key={s.id + time} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.dose} {s.unit}{time !== '—' && ` · ${time}`}</p>
                      </div>
                      <Button size="sm" variant={taken ? 'secondary' : 'default'} onClick={() => toggle(s, time)} aria-pressed={!!taken}>
                        {taken ? <><Undo2 /> Tomado</> : <><Check /> Marcar</>}
                      </Button>
                    </li>
                  )
                }))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Mis suplementos" icon={<Pill />} action={<Button size="sm" onClick={() => setEditing('new')}><Plus /> Añadir</Button>} />
          <CardContent>
            {supplements.length === 0 ? (
              <EmptyState icon={<Pill />} title="Sin suplementos" description="Añade los que tomas con su dosis y horarios." />
            ) : (
              <ul className="divide-y divide-border">
                {supplements.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setEditing(s)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-muted/40 cursor-pointer sm:px-2">
                      <span>
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">{s.dose} {s.unit}{s.times.length > 0 && ` · ${s.times.join(', ')}`}</span>
                      </span>
                      {!s.active && <Badge className="bg-muted">Inactivo</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {supplements.length > 0 && (
        <Card>
          <CardHeader title="Registro de los últimos 14 días" description="Tomas marcadas por día" icon={<Check />} />
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Suplemento</th>
                  {last14.map((d) => <th key={d} className="pb-2 font-medium capitalize">{fmt(d, 'EEEEE d')}</th>)}
                </tr>
              </thead>
              <tbody>
                {supplements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-2">{s.name}</td>
                    {last14.map((d) => {
                      const n = intakes.filter((i) => i.supplementId === s.id && i.date === d).length
                      return (
                        <td key={d} className="text-center">
                          <span className={cn('inline-flex size-6 items-center justify-center rounded-md', n ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground/40')} aria-label={n ? `${n} tomas` : 'Sin tomas'}>
                            {n || '·'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {editing && <SupplementDialog supplement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
