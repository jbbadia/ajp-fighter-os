import { useState, type ReactNode } from 'react'
import { Activity, BarChart3, CalendarCheck, Download, Dumbbell, Flame, Gauge, HeartPulse, Scale, Swords, Target } from 'lucide-react'
import { useDailyLogs, useGoals, useProfile, useSessions } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { Select } from '@/components/ui/form'
import { EmptyState, Progress } from '@/components/ui/misc'
import { BarTrend, LineTrend } from '@/components/charts/TrendChart'
import { consistencyStreak, weeksStats, type WeekStats } from '@/domain/analytics'
import { giNoGiMinutes } from '@/domain/bjjStats'
import { weightWithAverage } from '@/domain/nutritionStats'
import { StatTile } from '@/features/dashboard/widgets'
import { addDays, fmt, fromISODate, todayISO, toISODate } from '@/lib/dates'
import { download, sessionsCSV, weekStatsCSV } from '@/lib/export'
import { formatHours, formatMinutes, formatWeight, kgToUnit } from '@/lib/units'
import { cn, round } from '@/lib/utils'

type Range = '30' | '60' | '90'
const WEEKS: Record<Range, number> = { '30': 5, '60': 9, '90': 13 }

export function AnalyticsPage() {
  const sessions = useSessions()
  const logs = useDailyLogs()
  const goals = useGoals()
  const profile = useProfile()
  const unit = profile.settings.weightUnit
  const [range, setRange] = useState<Range>('30')
  const stats = weeksStats(WEEKS[range], sessions, logs, goals)
  const allStats = weeksStats(26, sessions, logs, goals)
  const current = stats[stats.length - 1]
  const streak = consistencyStreak(allStats)
  const from = toISODate(addDays(fromISODate(todayISO()), -Number(range) + 1))
  const split = giNoGiMinutes(sessions, from)
  const weights = weightWithAverage(logs, Number(range)).map((p) => ({
    ...p,
    value: round(kgToUnit(p.value, unit), 1),
    value2: p.value2 == null ? null : round(kgToUnit(p.value2, unit), 1),
  }))
  const totals = {
    sessions: stats.reduce((a, w) => a + w.completed, 0),
    bjj: stats.reduce((a, w) => a + w.bjjMin, 0),
    gym: stats.reduce((a, w) => a + w.gymMin, 0),
    cardio: stats.reduce((a, w) => a + w.cardioMin, 0),
  }
  const hasData = stats.some((w) => w.completed > 0 || w.checkins > 0)

  const bar = (pick: (w: WeekStats) => number | null) => stats.map((w) => ({ label: w.label, value: pick(w) ?? 0 }))
  const line = (pick: (w: WeekStats) => number | null) => stats.filter((w) => pick(w) !== null).map((w) => ({ label: w.label, value: pick(w)! }))

  return (
    <>
      <PageHeader
        title="Analítica"
        description="Evolución de tu preparación con tus datos registrados."
        actions={
          <>
            <Button variant="secondary" onClick={() => download(`ajp-estadisticas-${todayISO()}.csv`, weekStatsCSV(allStats))}><Download /> Estadísticas CSV</Button>
            <Button variant="secondary" onClick={() => download(`ajp-entrenamientos-${todayISO()}.csv`, sessionsCSV(sessions))}><Download /> Entrenamientos CSV</Button>
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between">
        <Tabs value={range} onChange={setRange} options={[{ value: '30', label: '30 días' }, { value: '60', label: '60 días' }, { value: '90', label: '90 días' }]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="col-span-2 p-4">
          <p className="text-xs font-medium text-muted-foreground">Consistencia semanal</p>
          <p className="mt-2 font-display text-3xl font-bold tabular">
            {current.compliance ?? '—'}{current.compliance !== null && <span className="text-base text-muted-foreground">%</span>}
          </p>
          <Progress className="mt-2" value={current.compliance ?? 0} label="Cumplimiento de la semana actual" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sesiones planificadas completadas esta semana · Racha: {streak} semana{streak === 1 ? '' : 's'} ≥ 80 %
          </p>
        </Card>
        <StatTile label="Sesiones" icon={<CalendarCheck />} value={totals.sessions} sub={`Últimos ${range} días`} />
        <StatTile label="BJJ" icon={<Swords />} value={formatHours(totals.bjj)} unit="h" sub={`Gi ${formatHours(split.gi)} h · No-Gi ${formatHours(split.nogi)} h`} />
        <StatTile label="Gimnasio" icon={<Dumbbell />} value={formatHours(totals.gym)} unit="h" sub={`Últimos ${range} días`} />
        <StatTile label="Cardio" icon={<HeartPulse />} value={formatHours(totals.cardio)} unit="h" sub={`Últimos ${range} días`} />
      </div>

      {!hasData ? (
        <EmptyState className="mt-6" icon={<BarChart3 />} title="Aún no hay datos en este periodo" description="Completa sesiones y haz check-ins para ver tus gráficas." />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ChartCard title="Peso" desc={`Diario y media de 7 días (${unit})`} icon={<Scale />} className="md:col-span-2">
            {weights.length >= 2 ? (
              <LineTrend data={weights} seriesNames={['Peso diario', 'Media 7 días']} format={(v) => `${v.toLocaleString('es-ES')} ${unit}`}
                reference={{ value: round(kgToUnit(profile.targetWeightKg, unit), 1), label: 'Objetivo' }} ariaLabel="Evolución del peso" height={200} />
            ) : <Few />}
          </ChartCard>
          <ChartCard title="Distribución Gi / No-Gi" desc={`Minutos completados · ${range} días`} icon={<Swords />}>
            {split.gi + split.nogi > 0 ? (
              <BarTrend data={[{ label: 'Gi', value: split.gi }, { label: 'No-Gi', value: split.nogi }]} format={formatMinutes} ariaLabel="Minutos de BJJ Gi frente a No-Gi" />
            ) : <Few />}
          </ChartCard>
          <ChartCard title="Sesiones por semana" desc="Completadas" icon={<CalendarCheck />}>
            <BarTrend data={bar((w) => w.completed)} format={(v) => `${v} sesiones`} ariaLabel="Sesiones completadas por semana" />
          </ChartCard>
          <ChartCard title="Tiempo de BJJ" desc="Horas por semana" icon={<Swords />}>
            <BarTrend data={bar((w) => round(w.bjjMin / 60, 1))} format={(v) => `${v.toLocaleString('es-ES')} h`} ariaLabel="Horas de BJJ por semana" />
          </ChartCard>
          <ChartCard title="Horas de gimnasio" desc="Por semana" icon={<Dumbbell />}>
            <BarTrend data={bar((w) => round(w.gymMin / 60, 1))} format={(v) => `${v.toLocaleString('es-ES')} h`} ariaLabel="Horas de gimnasio por semana" />
          </ChartCard>
          <ChartCard title="Cardio" desc="Minutos por semana" icon={<HeartPulse />}>
            <BarTrend data={bar((w) => w.cardioMin)} format={formatMinutes} ariaLabel="Minutos de cardio por semana" />
          </ChartCard>
          <ChartCard title="Evolución de cargas" desc={`Volumen de gimnasio (Σ reps × ${unit})`} icon={<Dumbbell />}>
            <BarTrend data={bar((w) => round(kgToUnit(w.gymVolumeKg, unit), 0))} format={(v) => `${v.toLocaleString('es-ES')} ${unit}`} ariaLabel="Volumen de gimnasio por semana" />
          </ChartCard>
          <ChartCard title="Carga de entrenamiento" desc="sRPE (min × RPE) por semana" icon={<Gauge />}>
            <BarTrend data={bar((w) => w.load)} format={(v) => `${v} UA`} ariaLabel="Carga de entrenamiento por semana" />
          </ChartCard>
          <ChartCard title="Evolución del RPE" desc="RPE medio por semana" icon={<Flame />}>
            {line((w) => w.avgRpe).length >= 2 ? <LineTrend data={line((w) => w.avgRpe)} format={(v) => `RPE ${v}`} ariaLabel="RPE medio semanal" /> : <Few />}
          </ChartCard>
          <ChartCard title="Recuperación" desc="Estado general medio semanal (1-10)" icon={<Activity />}>
            {line((w) => w.avgWellbeing).length >= 2 ? <LineTrend data={line((w) => w.avgWellbeing)} format={(v) => `${v}/10`} ariaLabel="Estado general medio semanal" /> : <Few />}
          </ChartCard>
          <ChartCard title="Cumplimiento de objetivos" desc="% de objetivos semanales cumplidos" icon={<Target />}>
            {stats.some((w) => w.goalsTotal) ? (
              <BarTrend data={bar((w) => (w.goalsTotal ? Math.round((w.goalsDone / w.goalsTotal) * 100) : 0))} format={(v) => `${v} %`} ariaLabel="Porcentaje de objetivos cumplidos por semana" />
            ) : <p className="text-xs text-muted-foreground">Define objetivos semanales en Competition Mode.</p>}
          </ChartCard>
        </div>
      )}

      <WeekComparison stats={allStats} unit={unit} />
    </>
  )
}

function ChartCard({ title, desc, icon, children, className }: { title: string; desc: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={desc} icon={icon} />
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const Few = () => <p className="text-xs text-muted-foreground">Datos insuficientes en este periodo.</p>

function WeekComparison({ stats, unit }: { stats: WeekStats[]; unit: 'kg' | 'lb' }) {
  const options = [...stats].reverse()
  const [a, setA] = useState(options[0]?.week ?? '')
  const [b, setB] = useState(options[1]?.week ?? '')
  const wa = stats.find((w) => w.week === a)
  const wb = stats.find((w) => w.week === b)
  if (!wa || !wb) return null
  const rows: [string, (w: WeekStats) => number | null, (v: number) => string, boolean?][] = [
    ['Sesiones completadas', (w) => w.completed, String],
    ['Cumplimiento', (w) => w.compliance, (v) => `${v} %`],
    ['BJJ', (w) => w.bjjMin, formatMinutes],
    ['Gimnasio', (w) => w.gymMin, formatMinutes],
    ['Cardio', (w) => w.cardioMin, formatMinutes],
    ['Carga (UA)', (w) => w.load, String],
    ['RPE medio', (w) => w.avgRpe, String],
    ['Volumen gym', (w) => w.gymVolumeKg, (v) => formatWeight(v, unit).replace(',0', '')],
    ['Fatiga media', (w) => w.avgFatigue, (v) => `${v}/10`, true],
    ['Sueño medio', (w) => w.avgSleepH, (v) => `${v} h`],
    ['Peso medio', (w) => w.avgWeightKg, (v) => formatWeight(v, unit)],
    ['Objetivos cumplidos', (w) => (w.goalsTotal ? w.goalsDone : null), String],
  ]
  return (
    <Card className="mt-6">
      <CardHeader title="Comparar semanas" icon={<BarChart3 />} />
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {([[a, setA, 'Semana A'], [b, setB, 'Semana B']] as const).map(([v, set, l]) => (
            <Select key={l} aria-label={l} value={v} onChange={(e) => set(e.target.value)}>
              {options.map((w) => <option key={w.week} value={w.week}>Semana del {fmt(w.week, 'd MMM yyyy')}</option>)}
            </Select>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Métrica</th>
                <th className="pb-2 font-medium">A · {fmt(wa.week, 'd MMM')}</th>
                <th className="pb-2 font-medium">B · {fmt(wb.week, 'd MMM')}</th>
                <th className="pb-2 font-medium">A − B</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-border">
              {rows.map(([label, pick, f, lowerIsBetter]) => {
                const va = pick(wa)
                const vb = pick(wb)
                const d = va !== null && vb !== null ? round(va - vb, 1) : null
                return (
                  <tr key={label}>
                    <td className="py-2">{label}</td>
                    <td>{va === null ? '—' : f(va)}</td>
                    <td>{vb === null ? '—' : f(vb)}</td>
                    <td className={cn(d && (lowerIsBetter ? d < 0 : d > 0) ? 'text-good' : d ? 'text-muted-foreground' : '')}>
                      {d === null ? '—' : `${d > 0 ? '+' : ''}${d.toLocaleString('es-ES')}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
