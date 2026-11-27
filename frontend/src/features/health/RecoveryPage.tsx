import { useState, type ReactNode } from 'react'
import { Activity, BatteryMedium, ClipboardPlus, HeartPulse, Moon, Pencil, ShieldAlert, Smile } from 'lucide-react'
import type { DailyLog } from '@/types/domain'
import { dailyLogStore, useDailyLogs, useProfile } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmButton, Tabs } from '@/components/ui/tabs'
import { Alert, EmptyState, StatusBadge } from '@/components/ui/misc'
import { LineTrend } from '@/components/charts/TrendChart'
import { useToast } from '@/components/ui/toast'
import { assessRecovery, RECOVERY_COPY, shoulderAlerts, sortedLogs } from '@/domain/recovery'
import { daysUntil, fmt } from '@/lib/dates'
import { formatWeight } from '@/lib/units'
import { CheckInDialog } from './CheckInDialog'

const MOBILITY = { normal: 'Normal', limited: 'Limitada', very_limited: 'Muy limitada' } as const
type Range = '30' | '60' | '90'

export function RecoveryPage() {
  const logs = useDailyLogs()
  const profile = useProfile()
  const toast = useToast()
  const [range, setRange] = useState<Range>('30')
  const [dialog, setDialog] = useState<{ date?: string } | null>(null)
  const recovery = assessRecovery(logs)
  const alerts = shoulderAlerts(logs)
  const inRange = sortedLogs(logs).filter((l) => -daysUntil(l.date) < Number(range))

  const series = (pick: (l: DailyLog) => number | null) =>
    inRange.filter((l) => pick(l) !== null).map((l) => ({ label: fmt(l.date, 'd MMM'), value: pick(l)! }))

  const charts: { title: string; icon: ReactNode; pick: (l: DailyLog) => number | null; fmt: (v: number) => string; desc: string }[] = [
    { title: 'Fatiga', icon: <Activity />, pick: (l) => l.fatigue, fmt: (v) => `${v}/10`, desc: '1 = fresco · 10 = agotado' },
    { title: 'Horas de sueño', icon: <Moon />, pick: (l) => l.sleepHours, fmt: (v) => `${v} h`, desc: 'Por noche' },
    { title: 'Calidad del sueño', icon: <Moon />, pick: (l) => l.sleepQuality, fmt: (v) => `${v}/10`, desc: '1 = muy mala · 10 = excelente' },
    { title: 'Estado general', icon: <Smile />, pick: (l) => l.wellbeing, fmt: (v) => `${v}/10`, desc: '1 = muy malo · 10 = excelente' },
    { title: 'Dolor de hombro', icon: <ShieldAlert />, pick: (l) => l.shoulderPain, fmt: (v) => `${v}/10`, desc: '0 = sin dolor · 10 = máximo' },
    { title: 'FC en reposo', icon: <HeartPulse />, pick: (l) => l.restingHr, fmt: (v) => `${v} lpm`, desc: 'Solo días en que la registraste' },
  ]

  return (
    <>
      <PageHeader
        title="Recuperación"
        description="Check-ins diarios, semáforo de recuperación y seguimiento del hombro."
        actions={<Button onClick={() => setDialog({})}><ClipboardPlus /> Check-in</Button>}
      />

      <div className="mb-4 space-y-2">
        {alerts.map((a) => <Alert key={a.id} severity={a.severity} title={a.title}>{a.detail}</Alert>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Semáforo de recuperación" icon={<BatteryMedium />} description={recovery.log ? `Último check-in: ${fmt(recovery.log.date, 'd MMM')}` : undefined} />
          <CardContent className="space-y-3">
            <StatusBadge level={recovery.level} label={RECOVERY_COPY[recovery.level].label} className="text-sm" />
            <p className="text-sm text-muted-foreground">{RECOVERY_COPY[recovery.level].advice}</p>
            {recovery.level !== 'unknown' && (
              <ul className="space-y-1 text-xs text-muted-foreground">{recovery.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Cómo funciona" icon={<ShieldAlert />} />
          <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3"><StatusBadge level="green" label="Verde" /><p className="mt-2">Indicadores dentro de rango. Sigue el plan.</p></div>
            <div className="rounded-lg border border-border p-3"><StatusBadge level="yellow" label="Amarillo" /><p className="mt-2">Fatiga ≥ 6, sueño &lt; 6,5 h o calidad ≤ 5, estrés ≥ 7, dolor de hombro ≥ 3 o movilidad limitada.</p></div>
            <div className="rounded-lg border border-border p-3"><StatusBadge level="red" label="Rojo" /><p className="mt-2">Fatiga u otro dolor ≥ 8, sueño &lt; 5 h, dolor de hombro ≥ 6 o movilidad muy limitada.</p></div>
            <p className="sm:col-span-3">Es una ayuda para ajustar la carga, no un diagnóstico. Ante dolor o síntomas preocupantes, consulta con un profesional sanitario.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Tendencias</h2>
        <Tabs value={range} onChange={setRange} options={[{ value: '30', label: '30 d' }, { value: '60', label: '60 d' }, { value: '90', label: '90 d' }]} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {charts.map((c) => {
          const data = series(c.pick)
          return (
            <Card key={c.title}>
              <CardHeader title={c.title} description={c.desc} icon={c.icon} />
              <CardContent>
                {data.length >= 2 ? (
                  <LineTrend data={data} format={c.fmt} ariaLabel={`${c.title}, últimos ${range} días`} domainPadding={c.title === 'FC en reposo' ? 3 : 1} />
                ) : (
                  <p className="text-xs text-muted-foreground">Se necesitan al menos 2 registros en este periodo.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-bold uppercase tracking-wide">Historial de check-ins</h2>
      <Card>
        <CardContent className="pt-5">
          {logs.length === 0 ? (
            <EmptyState icon={<ClipboardPlus />} title="Sin check-ins" description="Registra cómo te encuentras cada día." action={<Button onClick={() => setDialog({})}>Hacer el primero</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    {['Fecha', 'Peso', 'Sueño', 'Calidad', 'Fatiga', 'Estrés', 'Dolor musc.', 'General', 'FC rep.', 'Hombro', 'Fiesta', ''].map((h) => (
                      <th key={h} className="pb-2 pr-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...sortedLogs(logs)].reverse().map((l) => (
                    <tr key={l.id} className="tabular">
                      <td className="py-2 pr-3 capitalize">{fmt(l.date, 'EEE d MMM')}</td>
                      <td className="pr-3">{formatWeight(l.weightKg, profile.settings.weightUnit)}</td>
                      <td className="pr-3">{l.sleepHours ?? '—'}{l.sleepHours != null && ' h'}</td>
                      <td className="pr-3">{l.sleepQuality ?? '—'}</td>
                      <td className="pr-3">{l.fatigue ?? '—'}</td>
                      <td className="pr-3">{l.stress ?? '—'}</td>
                      <td className="pr-3">{l.soreness ?? '—'}</td>
                      <td className="pr-3">{l.wellbeing ?? '—'}</td>
                      <td className="pr-3">{l.restingHr ?? '—'}</td>
                      <td className="pr-3">
                        {l.shoulderPain ?? '—'}
                        {l.shoulderMobility && <span className="block text-[11px] text-muted-foreground">{MOBILITY[l.shoulderMobility]}</span>}
                      </td>
                      <td className="whitespace-nowrap pr-3">{l.nightOut ? `🍸 ${l.drinks ?? 0}` : '—'}</td>
                      <td className="whitespace-nowrap text-right">
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setDialog({ date: l.date })}><Pencil /></Button>
                        <ConfirmButton size="icon" variant="ghost" aria-label="Eliminar" title="Eliminar check-in" message={`Se eliminará el check-in del ${fmt(l.date, 'd MMM yyyy')}.`} onConfirm={() => { dailyLogStore.remove(l.id); toast('Check-in eliminado') }}>
                          <span className="sr-only">Eliminar</span>✕
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <CheckInDialog open={!!dialog} initialDate={dialog?.date} onClose={() => setDialog(null)} />
    </>
  )
}
