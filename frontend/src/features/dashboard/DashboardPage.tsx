import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BatteryMedium,
  CalendarCheck,
  ClipboardPlus,
  HandHelping,
  Dumbbell,
  Gauge,
  HeartPulse,
  Moon,
  Scale,
  ShieldAlert,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useDailyLogs, useProfile, useRehabLogs, useSessions } from '@/data'
import { DEFAULT_REHAB, sessionsOn } from '@/domain/rehab'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Alert, Badge, EmptyState, Progress, StatusBadge } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { BarTrend, LineTrend } from '@/components/charts/TrendChart'
import { CheckInDialog } from '@/features/health/CheckInDialog'
import { useSessionDialogs } from '@/features/training/SessionDialogs'
import { suggestAdjustments } from '@/domain/adaptation'
import {
  avgOf,
  currentWeight,
  cycleProgress,
  hasAny,
  nextSession,
  recentLogs,
  totalMinutes,
  weekSummary,
  weeklyCardioMinutes,
  weeklyLoad,
  weightSeries,
} from '@/domain/metrics'
import { assessRecovery, RECOVERY_COPY, shoulderAlerts } from '@/domain/recovery'
import { BELT_LABEL } from '@/domain/sessionMeta'
import { fmt, todayISO } from '@/lib/dates'
import { formatHours, formatMinutes, formatWeight, kgToUnit } from '@/lib/units'
import { cn, round } from '@/lib/utils'
import { NextSessionCard, StatTile, WeekStrip } from './widgets'
import { exerciseHistory, personalRecords } from '@/domain/gymStats'

const CLEARANCE_LABEL = {
  pending: 'Pendiente de valoración',
  limited: 'Autorización parcial',
  full: 'Autorización completa',
} as const

const MOBILITY_LABEL = { normal: 'Normal', limited: 'Limitada', very_limited: 'Muy limitada' } as const

export function DashboardPage() {
  const profile = useProfile()
  const sessions = useSessions()
  const logs = useDailyLogs()
  const [checkInOpen, setCheckInOpen] = useState(false)
  const dialogs = useSessionDialogs()
  const rehabLogs = useRehabLogs()
  const rehab = profile.rehab ?? DEFAULT_REHAB
  const rehabToday = sessionsOn(rehabLogs, todayISO())

  const unit = profile.settings.weightUnit
  const cycle = cycleProgress(profile)
  const week = weekSummary(sessions)
  const weight = currentWeight(profile, logs)
  const recovery = assessRecovery(logs)
  const alerts = shoulderAlerts(logs)
  const next = nextSession(sessions)
  const last7 = recentLogs(logs, 7)
  const hasTodayLog = logs.some((l) => l.date === todayISO())
  const adjustments = suggestAdjustments(sessions, logs, profile.shoulder)

  const load = weeklyLoad(sessions)
  const cardio = weeklyCardioMinutes(sessions)
  const weights = weightSeries(logs, 30).map((p) => ({ ...p, value: round(kgToUnit(p.value, unit), 1) }))
  const sleep = last7.filter((l) => l.sleepHours !== null).map((l) => ({ label: fmt(l.date, 'EEE'), value: l.sleepHours! }))

  const thisWeekLoad = load[load.length - 1].value
  const prevWeeks = load.slice(-5, -1).filter((p) => p.value > 0)
  const prevAvg = prevWeeks.length ? prevWeeks.reduce((a, p) => a + p.value, 0) / prevWeeks.length : null
  const latestShoulder = [...last7].reverse().find((l) => l.shoulderPain !== null || l.shoulderMobility !== null)

  return (
    <>
      <PageHeader
        title={`Hola, ${profile.name}`}
        description={fmt(new Date(), "EEEE d 'de' MMMM")}
        actions={
          <Button variant={hasTodayLog ? 'secondary' : 'default'} onClick={() => setCheckInOpen(true)}>
            <ClipboardPlus /> {hasTodayLog ? 'Editar check-in de hoy' : 'Check-in diario'}
          </Button>
        }
      />

      {(alerts.length > 0 || recovery.level === 'red') && (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <Alert key={a.id} severity={a.severity} title={a.title}>{a.detail}</Alert>
          ))}
          {recovery.level === 'red' && (
            <Alert severity="critical" title={RECOVERY_COPY.red.label}>{RECOVERY_COPY.red.advice}</Alert>
          )}
        </div>
      )}

      {adjustments.length > 0 && (
        <Link to="/calendario" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/60 p-4 text-sm hover:bg-accent">
          <span>
            <span className="font-medium">{adjustments.length} ajuste{adjustments.length > 1 ? 's' : ''} sugerido{adjustments.length > 1 ? 's' : ''} para tu planificación</span>
            <span className="block text-xs text-muted-foreground">{adjustments[0].title}</span>
          </span>
          <span className="shrink-0 text-primary">Revisar →</span>
        </Link>
      )}

      {profile.rehab && (
        <Link
          to="/rehab"
          className={cn(
            'mb-6 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm',
            rehabToday >= rehab.sessionsPerDay ? 'border-good/40 bg-good/10' : 'border-border bg-card hover:bg-muted',
          )}
        >
          <span className="flex items-center gap-3">
            <HandHelping className="size-5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">Rehab de hombro · hoy {Math.min(rehabToday, rehab.sessionsPerDay)}/{rehab.sessionsPerDay}</span>
              <span className="block text-xs text-muted-foreground">
                {rehabToday >= rehab.sessionsPerDay ? 'Hecho por hoy' : 'Pauta del fisio · protocolo Derby, a la hora que quieras'}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-primary">{rehabToday >= rehab.sessionsPerDay ? 'Ver →' : 'Hacer →'}</span>
        </Link>
      )}

      {/* Countdown + recovery */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Trophy className="size-4 text-primary" aria-hidden />
                <span className="text-sm font-semibold">{profile.competition.name}</span>
                {!profile.competition.dateConfirmed && (
                  <Badge className="bg-warning/15 text-warning">Fecha estimada</Badge>
                )}
              </div>
              <p className="mt-3 font-display text-7xl font-bold leading-none tabular">
                {Math.max(0, cycle.daysLeft)}
                <span className="ml-2 text-2xl text-muted-foreground">días</span>
              </p>
              <p className="mt-2 text-sm capitalize text-muted-foreground">
                {fmt(profile.competition.date, profile.competition.dateConfirmed ? "EEEE d 'de' MMMM yyyy" : "MMMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs sm:max-w-56 sm:justify-end">
              <Badge className="bg-muted">Cinturón {BELT_LABEL[profile.belt].toLowerCase()}</Badge>
              {profile.competition.modalities.map((m) => (
                <Badge key={m} className="bg-muted">{m === 'gi' ? 'Gi' : 'No-Gi'}</Badge>
              ))}
              {profile.competition.weightCategory ? (
                <Badge className="bg-muted">{profile.competition.weightCategory}</Badge>
              ) : (
                <Link to="/perfil" className="text-warning hover:underline">Categoría de peso sin configurar</Link>
              )}
            </div>
          </div>
          <div className="relative border-t border-border p-5">
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-muted-foreground">Progreso del ciclo de preparación</span>
              <span className="tabular font-medium">{cycle.pct}%</span>
            </div>
            <Progress value={cycle.pct} label="Progreso del ciclo de preparación" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Tiempo transcurrido desde el inicio de la preparación ({fmt(profile.prepStartDate, 'd MMM yyyy')}). No es una medida de forma física.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Estado de recuperación" icon={<BatteryMedium />} description={recovery.log ? `Check-in del ${fmt(recovery.log.date, 'd MMM')}` : undefined} />
          <CardContent className="space-y-3">
            <StatusBadge level={recovery.level} label={RECOVERY_COPY[recovery.level].label} className="text-sm" />
            <p className="text-sm text-muted-foreground">{RECOVERY_COPY[recovery.level].advice}</p>
            {recovery.level !== 'unknown' && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {recovery.reasons.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            )}
            {!hasTodayLog && (
              <Button variant="secondary" size="sm" onClick={() => setCheckInOpen(true)}>
                <ClipboardPlus /> Registrar check-in
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Peso actual"
          icon={<Scale />}
          value={formatWeight(weight.kg, unit, false)}
          unit={unit}
          sub={weight.source === 'log' ? `Registro del ${fmt(weight.date!, 'd MMM')}` : 'Dato del perfil'}
        />
        <StatTile
          label="Peso objetivo"
          icon={<TrendingUp />}
          value={formatWeight(profile.targetWeightKg, unit, false)}
          unit={unit}
          sub={(() => {
            const diff = round(kgToUnit(weight.kg - profile.targetWeightKg, unit), 1)
            return diff === 0 ? 'En objetivo' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-ES')} ${unit} vs. objetivo`
          })()}
        />
        <StatTile
          label="Sesiones semana"
          icon={<CalendarCheck />}
          value={week.completed}
          unit={`/ ${week.planned}`}
          sub="Completadas / planificadas"
        />
        <StatTile
          label="Horas BJJ"
          icon={<Swords />}
          value={formatHours(week.bjjMin)}
          unit="h"
          sub={`Esta semana · ${formatHours(totalMinutes(sessions, 'bjj'))} h acumuladas`}
        />
        <StatTile
          label="Horas gimnasio"
          icon={<Dumbbell />}
          value={formatHours(week.gymMin)}
          unit="h"
          sub={`Esta semana · ${formatHours(totalMinutes(sessions, 'gym'))} h acumuladas`}
        />
        <StatTile label="Cardio" icon={<HeartPulse />} value={week.cardioMin} unit="min" sub="Esta semana" />
      </div>

      {/* Next session + week */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <NextSessionCard session={next} profile={profile} onOpen={dialogs.run} />
        <WeekStrip sessions={sessions} onOpen={dialogs.open} />
      </div>

      {/* Sport indicators */}
      <h2 className="mb-3 mt-8 font-display text-xl font-bold uppercase tracking-wide">Indicadores</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Carga semanal" description="sRPE = minutos × RPE de sesiones completadas" icon={<Gauge />} />
          <CardContent>
            {hasAny(load) ? (
              <BarTrend data={load} format={(v) => `${Math.round(v)} UA`} ariaLabel="Carga de entrenamiento por semana, últimas 8 semanas" />
            ) : (
              <EmptyState icon={<Gauge />} title="Sin sesiones completadas" description="Completa una sesión indicando su RPE para calcular la carga." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Evolución del peso" description="Últimos 30 días · peso en ayunas" icon={<Scale />} />
          <CardContent>
            {weights.length >= 2 ? (
              <LineTrend
                data={weights}
                format={(v) => `${v.toLocaleString('es-ES')} ${unit}`}
                reference={{ value: round(kgToUnit(profile.targetWeightKg, unit), 1), label: 'Objetivo' }}
                ariaLabel="Peso en ayunas de los últimos 30 días"
              />
            ) : (
              <EmptyState
                icon={<Scale />}
                title={weights.length === 1 ? 'Un registro de peso' : 'Sin registros de peso'}
                description="Registra tu peso en ayunas en el check-in diario. La gráfica aparece a partir de 2 registros."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Volumen cardiovascular" description="Minutos de cardio completados por semana" icon={<HeartPulse />} />
          <CardContent>
            {hasAny(cardio) ? (
              <BarTrend data={cardio} format={(v) => formatMinutes(v)} ariaLabel="Minutos de cardio por semana, últimas 8 semanas" />
            ) : (
              <EmptyState icon={<HeartPulse />} title="Sin sesiones de cardio" description="Completa sesiones de Zona 2 o HIIT para ver tu evolución." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Sueño" description="Últimos 7 días" icon={<Moon />} />
          <CardContent>
            {last7.some((l) => l.sleepHours !== null || l.sleepQuality !== null) ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Mini label="Horas medias" value={avgOf(last7, (l) => l.sleepHours)} suffix=" h" />
                  <Mini label="Calidad media" value={avgOf(last7, (l) => l.sleepQuality)} suffix="/10" />
                </div>
                {sleep.length >= 2 && <BarTrend data={sleep} height={110} format={(v) => `${v} h`} ariaLabel="Horas de sueño de los últimos 7 días" />}
              </>
            ) : (
              <EmptyState icon={<Moon />} title="Sin datos de sueño" description="Añade horas y calidad del sueño en el check-in." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Fatiga acumulada" description="Media de los últimos 7 días" icon={<Activity />} />
          <CardContent>
            {last7.some((l) => l.fatigue !== null || l.soreness !== null) || thisWeekLoad > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <Mini label="Fatiga" value={avgOf(last7, (l) => l.fatigue)} suffix="/10" />
                <Mini label="Dolor muscular" value={avgOf(last7, (l) => l.soreness)} suffix="/10" />
                <Mini label="Carga esta semana" value={thisWeekLoad || null} suffix=" UA" />
                <Mini
                  label="vs. media 4 semanas"
                  value={prevAvg ? round(((thisWeekLoad - prevAvg) / prevAvg) * 100, 0) : null}
                  suffix="%"
                  signed
                />
              </div>
            ) : (
              <EmptyState icon={<Activity />} title="Sin datos de fatiga" description="Registra tu fatiga en el check-in y completa sesiones con RPE." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Estado del hombro" icon={<ShieldAlert />} action={<Link to="/perfil" className="text-xs text-primary hover:underline">Editar</Link>} />
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={profile.shoulder.clearance === 'full' ? 'bg-good/15 text-good' : 'bg-warning/15 text-warning'}>
                {CLEARANCE_LABEL[profile.shoulder.clearance]}
              </Badge>
            </div>
            <ul className="space-y-1.5 text-sm">
              <Row label="Cargas tren superior" ok={profile.shoulder.loadsAuthorized} />
              <Row label="Sparring intenso" ok={profile.shoulder.intenseSparringAuthorized} />
            </ul>
            {latestShoulder ? (
              <div className="grid grid-cols-2 gap-2">
                <Mini label="Dolor (último)" value={latestShoulder.shoulderPain} suffix="/10" />
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Movilidad</p>
                  <p className="text-sm font-semibold">{latestShoulder.shoulderMobility ? MOBILITY_LABEL[latestShoulder.shoulderMobility] : '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin registros de dolor o movilidad en los últimos 7 días.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader title="Evolución de fuerza" description="Cargas y récords personales por ejercicio" icon={<Timer />} />
          <CardContent>
            <StrengthSummary />
          </CardContent>
        </Card>
      </div>

      <CheckInDialog open={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </>
  )
}

/** Top-set evolution of the most-logged exercise + latest personal records. */
function StrengthSummary() {
  const sessions = useSessions()
  const unit = useProfile().settings.weightUnit
  const prs = personalRecords(sessions)
  if (!prs.length) {
    return (
      <EmptyState
        icon={<Dumbbell />}
        title="Sin series registradas"
        description="La evolución de fuerza se calcula con las series que registres en el módulo de gimnasio."
        action={<Link to="/gimnasio" className="text-sm text-primary hover:underline">Ir a gimnasio</Link>}
      />
    )
  }
  const histories = prs.map((p) => ({ p, h: exerciseHistory(sessions, p.exerciseId) })).sort((a, b) => b.h.length - a.h.length)
  const main = histories[0]
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">{main.p.name} · peso de la mejor serie</p>
        {main.h.length >= 2 ? (
          <LineTrend
            data={main.h.map((x) => ({ label: x.label, value: round(kgToUnit(x.topWeight, unit), 1) }))}
            format={(v) => `${v.toLocaleString('es-ES')} ${unit}`}
            ariaLabel={`Evolución de ${main.p.name}`}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Registra este ejercicio en otra sesión para ver su evolución.</p>
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        <li className="text-xs text-muted-foreground">Récords personales</li>
        {prs.slice(0, 5).map((p) => (
          <li key={p.exerciseId} className="flex justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <span className="tabular shrink-0 font-medium">{formatWeight(p.maxWeight, unit)} × {p.repsAtMax}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Mini({ label, value, suffix = '', signed }: { label: string; value: number | null; suffix?: string; signed?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular text-sm font-semibold">
        {value === null ? '—' : `${signed && value > 0 ? '+' : ''}${value.toLocaleString('es-ES')}${suffix}`}
      </p>
    </div>
  )
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? 'text-good' : 'text-warning'}>{ok ? '✓ Autorizado' : '✕ No autorizado'}</span>
    </li>
  )
}
