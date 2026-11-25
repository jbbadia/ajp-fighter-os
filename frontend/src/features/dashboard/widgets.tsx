import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Clock, Play, Target, TriangleAlert } from 'lucide-react'
import type { AthleteProfile, TrainingSession } from '@/types/domain'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { DISCIPLINE_STYLE, INTENSITY_LABEL, SESSION_TYPES, STATUS_LABEL } from '@/domain/sessionMeta'
import { clearanceWarning } from '@/domain/recovery'
import { addDays, fmt, todayISO, toISODate, weekRange } from '@/lib/dates'
import { formatMinutes } from '@/lib/units'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  unit,
  sub,
  icon,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  icon: ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <span className="[&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold leading-none tabular">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

export function SessionTypeIcon({ session, className }: { session: Pick<TrainingSession, 'type'>; className?: string }) {
  const meta = SESSION_TYPES[session.type]
  return (
    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', DISCIPLINE_STYLE[meta.discipline], className)}>
      <meta.icon className="size-5" aria-hidden />
    </div>
  )
}

export function NextSessionCard({
  session,
  profile,
  onOpen,
}: {
  session: TrainingSession | null
  profile: AthleteProfile
  onOpen: (id: string) => void
}) {
  if (!session) {
    return (
      <Card>
        <CardHeader title="Próximo entrenamiento" icon={<CalendarClock />} />
        <CardContent>
          <EmptyState
            icon={<CalendarClock />}
            title="No hay sesiones planificadas"
            description="Las sesiones planificadas aparecerán aquí. El calendario completo llega en la Fase 2."
          />
        </CardContent>
      </Card>
    )
  }
  const meta = SESSION_TYPES[session.type]
  const warning = clearanceWarning(session.requiresClearance, profile.shoulder)
  const isToday = session.date === todayISO()
  const inProgress = session.status === 'in_progress'

  return (
    <Card className={cn(inProgress && 'border-primary/50')}>
      <CardHeader
        title="Próximo entrenamiento"
        icon={<CalendarClock />}
        action={inProgress ? <Badge className="bg-primary/15 text-primary">En curso</Badge> : isToday ? <Badge className="bg-accent text-accent-foreground">Hoy</Badge> : null}
      />
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <SessionTypeIcon session={session} />
          <div className="min-w-0">
            <p className="font-semibold">{meta.label}</p>
            <p className="text-sm text-muted-foreground">{session.objective}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          {[
            ['Cuándo', `${isToday ? 'Hoy' : fmt(session.date, 'EEE d MMM')} · ${session.time}`],
            ['Duración', formatMinutes(session.durationMin)],
            ['Intensidad', INTENSITY_LABEL[session.intensity]],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted/60 p-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
        {session.activities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {session.activities.map((a) => (
              <li key={a} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{a}</li>
            ))}
          </ul>
        )}
        {warning && (
          <p className="flex gap-2 text-xs text-warning">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {warning}
          </p>
        )}
        <Button className="w-full" size="lg" onClick={() => onOpen(session.id)}>
          <Play /> {inProgress ? 'Continuar entrenamiento' : 'Comenzar entrenamiento'}
        </Button>
      </CardContent>
    </Card>
  )
}

export function WeekStrip({ sessions, onOpen }: { sessions: TrainingSession[]; onOpen: (id: string) => void }) {
  const { start } = weekRange()
  const today = todayISO()
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)))

  return (
    <Card>
      <CardHeader title="Esta semana" description="Planificación y estado de cada sesión" icon={<Target />} />
      <CardContent>
        <ol className="space-y-1">
          {days.map((d) => {
            const daySessions = sessions.filter((s) => s.date === d).sort((a, b) => a.time.localeCompare(b.time))
            return (
              <li key={d} className={cn('flex gap-3 rounded-lg px-2 py-2', d === today && 'bg-muted/60')}>
                <div className="w-10 shrink-0 text-center">
                  <p className="text-[11px] uppercase text-muted-foreground">{fmt(d, 'EEE')}</p>
                  <p className={cn('font-display text-lg font-bold leading-none', d === today && 'text-primary')}>{fmt(d, 'd')}</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {daySessions.length === 0 && <span className="text-xs text-muted-foreground">Sin sesiones</span>}
                  {daySessions.map((s) => {
                    const meta = SESSION_TYPES[s.type]
                    const clickable = s.type !== 'rest'
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!clickable}
                        onClick={() => onOpen(s.id)}
                        title={`${meta.label} · ${STATUS_LABEL[s.status]}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-opacity',
                          DISCIPLINE_STYLE[meta.discipline],
                          clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                          s.status === 'skipped' && 'line-through opacity-50',
                        )}
                      >
                        {s.status === 'completed' ? <CheckCircle2 className="size-3.5" aria-label="Completada" /> : <meta.icon className="size-3.5" aria-hidden />}
                        {meta.short}
                        {s.type !== 'rest' && (
                          <span className="inline-flex items-center gap-0.5 opacity-70">
                            <Clock className="size-3" aria-hidden />
                            {s.time}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Edita, arrastra sesiones o consulta la vista mensual en el <Link to="/calendario" className="text-primary hover:underline">calendario</Link>.
        </p>
      </CardContent>
    </Card>
  )
}
