import { useState } from 'react'
import { Activity, BookOpen, ExternalLink, HeartPulse, Scale, Settings2, Trophy } from 'lucide-react'
import { useDailyLogs, useProfile, useSessions, useSimulations, useTechniques } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/misc'
import { SectionTitle } from '@/components/ui/tabs'
import { weeksStats } from '@/domain/analytics'
import { currentWeight } from '@/domain/metrics'
import { assessRecovery, RECOVERY_COPY } from '@/domain/recovery'
import { BELT_LABEL, MODALITY_LABEL } from '@/domain/sessionMeta'
import { daysUntil, fmt, todayISO } from '@/lib/dates'
import { formatWeight, kgToUnit } from '@/lib/units'
import { average, round } from '@/lib/utils'
import { ChecklistCard, CompetitionSettingsDialog, PhasesCard, WeeklyGoalsCard } from './CompetitionPanels'
import { FightSimulator } from './FightSimulator'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  )
}

export function CompetitionPage() {
  const profile = useProfile()
  const sessions = useSessions()
  const logs = useDailyLogs()
  const techniques = useTechniques()
  const sims = useSimulations()
  const [settings, setSettings] = useState(false)
  const c = profile.competition
  const unit = profile.settings.weightUnit
  const days = daysUntil(c.date)
  const recovery = assessRecovery(logs)
  const last4 = weeksStats(5, sessions, logs, []).slice(0, 4) // 4 complete weeks before the current
  const compliance = last4.map((w) => w.compliance).filter((v): v is number => v !== null)
  const weight = currentWeight(profile, logs)
  const limit = profile.rules.weightLimitKg
  const phase = profile.phases.find((p) => todayISO() >= p.start && todayISO() <= p.end)

  return (
    <>
      <PageHeader title="Competition Mode" description="Todo lo que necesitas para llegar al torneo en las mejores condiciones." actions={<Button variant="secondary" onClick={() => setSettings(true)}><Settings2 /> Competición y reglamento</Button>} />

      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-primary" /> {c.name}</p>
            <p className="mt-2 font-display text-8xl font-bold leading-none tabular">{Math.max(0, days)}<span className="ml-2 text-3xl text-muted-foreground">días</span></p>
            <p className="mt-2 text-sm capitalize text-muted-foreground">
              {fmt(c.date, c.dateConfirmed ? "EEEE d 'de' MMMM yyyy" : 'MMMM yyyy')}
              {!c.dateConfirmed && <Badge className="ml-2 bg-warning/15 normal-case text-warning">Fecha estimada</Badge>}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Cinturón</dt><dd className="font-medium">{BELT_LABEL[profile.belt]}</dd>
            <dt className="text-muted-foreground">Modalidad</dt><dd className="font-medium">{c.modalities.map((m) => MODALITY_LABEL[m]).join(' y ')}</dd>
            <dt className="text-muted-foreground">Categoría</dt><dd className="font-medium">{c.weightCategory || <span className="text-warning">Sin configurar</span>}</dd>
            <dt className="text-muted-foreground">Combate</dt><dd className="font-medium">{profile.rules.matchDurationMin ? `${profile.rules.matchDurationMin} min` : <span className="text-warning">Sin configurar</span>}</dd>
            <dt className="text-muted-foreground">Fase</dt><dd className="font-medium">{phase?.name ?? '—'}</dd>
            {profile.rules.sourceUrl && (
              <>
                <dt className="text-muted-foreground">Reglamento</dt>
                <dd><a className="inline-flex items-center gap-1 text-primary hover:underline" href={profile.rules.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir <ExternalLink className="size-3" /></a></dd>
              </>
            )}
          </dl>
        </div>
      </Card>

      <SectionTitle>Estado de la preparación</SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-muted-foreground">Indicadores calculados con tus registros. No son predicciones de resultado ni valoraciones médicas.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Estado físico" icon={<Activity />} />
          <CardContent className="space-y-2">
            <StatusBadge level={recovery.level} label={RECOVERY_COPY[recovery.level].label} />
            <Metric label="Cumplimiento (4 sem.)" value={compliance.length ? `${Math.round(average(compliance)!)} %` : '—'} />
            <Metric label="Sesiones (4 sem.)" value={String(last4.reduce((a, w) => a + w.completed, 0))} />
            <Metric label="Hombro" value={profile.shoulder.intenseSparringAuthorized ? 'Sparring autorizado' : 'Sin autorización de sparring'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Preparación técnica" icon={<BookOpen />} />
          <CardContent className="space-y-2">
            <Metric label="Técnicas dominadas" value={String(techniques.filter((t) => t.status === 'mastered').length)} />
            <Metric label="En desarrollo" value={String(techniques.filter((t) => t.status === 'developing').length)} />
            <Metric label="Principales de competición" value={String(techniques.filter((t) => t.competitionMain).length)} />
            <Metric label="Horas BJJ (4 sem.)" value={`${round(last4.reduce((a, w) => a + w.bjjMin, 0) / 60, 1).toLocaleString('es-ES')} h`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Preparación cardiovascular" icon={<HeartPulse />} />
          <CardContent className="space-y-2">
            <Metric label="Cardio medio / semana" value={`${Math.round(last4.reduce((a, w) => a + w.cardioMin, 0) / 4)} min`} />
            <Metric label="Simulaciones" value={String(sims.length)} />
            <Metric label="Última simulación" value={sims.length ? fmt([...sims].sort((a, b) => b.date.localeCompare(a.date))[0].date, 'd MMM') : '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Peso" icon={<Scale />} />
          <CardContent className="space-y-2">
            <Metric label="Actual" value={formatWeight(weight.kg, unit)} />
            <Metric label="Objetivo" value={formatWeight(profile.targetWeightKg, unit)} />
            <Metric label="Límite categoría" value={limit ? formatWeight(limit, unit) : 'Sin configurar'} />
            {limit && (
              <p className={weight.kg > limit ? 'text-xs text-warning' : 'text-xs text-good'}>
                {weight.kg > limit
                  ? `${round(kgToUnit(weight.kg - limit, unit), 1).toLocaleString('es-ES')} ${unit} por encima del límite`
                  : `${round(kgToUnit(limit - weight.kg, unit), 1).toLocaleString('es-ES')} ${unit} de margen`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PhasesCard profile={profile} />
        <ChecklistCard profile={profile} />
      </div>
      <div className="mt-4"><WeeklyGoalsCard /></div>

      <SectionTitle>Simulaciones de competición</SectionTitle>
      <FightSimulator />

      {settings && <CompetitionSettingsDialog profile={profile} onClose={() => setSettings(false)} />}
    </>
  )
}
