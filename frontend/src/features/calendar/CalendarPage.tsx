import { useMemo, useState, type DragEvent } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarPlus, CheckCircle2, HandHelping, ChevronLeft, ChevronRight, Plus, Sparkles, Wand2, X } from 'lucide-react'
import type { TrainingSession } from '@/types/domain'
import { sessionStore, useDailyLogs, useProfile, useRehabLogs, useSessions } from '@/data'
import { Link } from 'react-router-dom'
import { sessionsOn } from '@/domain/rehab'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { DISCIPLINE_STYLE, SESSION_TYPES, STATUS_LABEL } from '@/domain/sessionMeta'
import { suggestAdjustments } from '@/domain/adaptation'
import { generatePlannedSessions } from '@/domain/planTemplate'
import { addDays, fmt, fromISODate, todayISO, toISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useSessionDialogs } from '@/features/training/SessionDialogs'

type View = 'week' | 'month'
const WEEK = { weekStartsOn: 1 as const }
const DISMISSED_KEY = 'ajp-fighter-os:dismissed-adjustments'

export function CalendarPage() {
  const sessions = useSessions()
  const logs = useDailyLogs()
  const rehabLogs = useRehabLogs()
  const profile = useProfile()
  const dialogs = useSessionDialogs()
  const toast = useToast()
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))

  const byDate = useMemo(() => {
    const m = new Map<string, TrainingSession[]>()
    for (const s of [...sessions].sort((a, b) => a.time.localeCompare(b.time))) {
      m.set(s.date, [...(m.get(s.date) ?? []), s])
    }
    return m
  }, [sessions])

  const days = useMemo(() => {
    const start = view === 'week' ? startOfWeek(cursor, WEEK) : startOfWeek(startOfMonth(cursor), WEEK)
    const end = view === 'week' ? endOfWeek(cursor, WEEK) : endOfWeek(endOfMonth(cursor), WEEK)
    const out: string[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(toISODate(d))
    return out
  }, [view, cursor])

  const adjustments = suggestAdjustments(sessions, logs, profile.shoulder).filter((a) => !dismissed.includes(a.id))

  const shift = (dir: number) => setCursor((c) => (view === 'week' ? addDays(c, 7 * dir) : addMonths(c, dir)))
  const today = todayISO()

  const onDrop = (e: DragEvent, date: string) => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/session-id')
    const s = sessionStore.get(id)
    if (!s || s.date === date) return
    if (s.status === 'completed' && date > today) return toast('Una sesión completada no puede moverse al futuro', 'error')
    sessionStore.update(id, { date })
    toast(`Sesión movida al ${fmt(date, "EEEE d 'de' MMMM")}`)
  }

  const weekStart = toISODate(startOfWeek(cursor, WEEK))
  const weekEnd = toISODate(endOfWeek(cursor, WEEK))
  const canGenerate = view === 'week' && weekEnd >= today
  const generateWeek = () => {
    const from = weekStart < today ? today : weekStart
    const existingDates = new Set(sessions.filter((s) => s.date >= from && s.date <= weekEnd && !s.unplanned).map((s) => s.date))
    const fresh = generatePlannedSessions(profile.shoulder, from, weekEnd).filter((s) => !existingDates.has(s.date))
    fresh.forEach((s) => sessionStore.create(s))
    toast(fresh.length ? `${fresh.length} sesiones añadidas desde la plantilla` : 'La semana ya tiene sesiones planificadas', fresh.length ? 'success' : 'error')
  }

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-200)))
  }

  const title =
    view === 'week'
      ? `${fmt(weekStart, 'd MMM')} – ${fmt(weekEnd, 'd MMM yyyy')}`
      : fmt(cursor, 'MMMM yyyy')

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Planifica, mueve sesiones arrastrándolas y registra lo que haces."
        actions={
          <>
            <Button variant="secondary" onClick={() => dialogs.edit(null, { unplanned: true, status: 'completed', date: today })}>
              <CheckCircle2 /> No planificada
            </Button>
            <Button onClick={() => dialogs.edit(null, { date: today })}>
              <Plus /> Nueva sesión
            </Button>
          </>
        }
      />

      {adjustments.length > 0 && (
        <Card className="mb-4 border-primary/30">
          <CardHeader title="Ajustes sugeridos" description="Basados en tu recuperación, el estado del hombro y las sesiones pendientes" icon={<Sparkles />} />
          <CardContent className="space-y-2">
            {adjustments.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.kind === 'missed' && (
                    <Button size="sm" variant="ghost" onClick={() => dialogs.open(a.sessionId)}>Registrar</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)} aria-label="Ignorar sugerencia">
                    <X /> Ignorar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      sessionStore.update(a.sessionId, a.patch)
                      toast('Ajuste aplicado')
                    }}
                  >
                    <Wand2 /> Aplicar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onChange={setView} options={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }]} />
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Anterior" onClick={() => shift(-1)}><ChevronLeft /></Button>
          <Button size="sm" variant="secondary" onClick={() => setCursor(new Date())}>Hoy</Button>
          <Button size="icon" variant="ghost" aria-label="Siguiente" onClick={() => shift(1)}><ChevronRight /></Button>
        </div>
        <h2 className="font-display text-xl font-bold capitalize">{title}</h2>
        {canGenerate && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={generateWeek}>
            <CalendarPlus /> Rellenar semana con la plantilla
          </Button>
        )}
      </div>

      {view === 'month' && (
        <div className="mb-1 hidden grid-cols-7 gap-1 text-center text-[11px] uppercase text-muted-foreground md:grid">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}
        </div>
      )}
      <div className={cn('grid gap-2', view === 'week' ? 'md:grid-cols-7' : 'grid-cols-7 gap-1')}>
        {days.map((d) => {
          const list = byDate.get(d) ?? []
          const outside = view === 'month' && !isSameMonth(fromISODate(d), cursor)
          return (
            <div
              key={d}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(d)
              }}
              onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
              onDrop={(e) => onDrop(e, d)}
              className={cn(
                'group flex flex-col rounded-xl border bg-card p-2 transition-colors',
                view === 'week' ? 'min-h-28 md:min-h-64' : 'min-h-20 md:min-h-28',
                d === today ? 'border-primary/60' : 'border-border',
                dragOver === d && 'border-primary bg-accent',
                outside && 'opacity-40',
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className={cn('text-xs', d === today ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                  {view === 'week' ? <span className="capitalize">{fmt(d, 'EEE d')}</span> : fmt(d, 'd')}
                </span>
                <button
                  type="button"
                  aria-label={`Añadir sesión el ${fmt(d, 'd MMMM')}`}
                  onClick={() => dialogs.edit(null, { date: d })}
                  className="rounded p-0.5 text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {list.map((s) => (
                  <SessionChip key={s.id} s={s} compact={view === 'month'} onClick={() => dialogs.open(s.id)} onEdit={() => dialogs.edit(s.id)} />
                ))}
                {profile.rehab && (() => {
                  // Physio rehab: every day, at any time (not a training session, so it does not count in the stats).
                  const n = sessionsOn(rehabLogs, d)
                  const goal = profile.rehab.sessionsPerDay
                  return (
                    <Link
                      to="/rehab"
                      title={`Rehab hombro: ${n} de ${goal} sesiones`}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px]',
                        n >= goal ? 'border-good/40 bg-good/10 text-good' : 'border-dashed border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {n >= goal ? <CheckCircle2 className="size-3 shrink-0" /> : <HandHelping className="size-3 shrink-0" />}
                      <span className="truncate">{view === 'month' ? `${n}/${goal}` : `Rehab hombro ${n}/${goal}`}</span>
                    </Link>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Consejo: arrastra una sesión a otro día para moverla. En el móvil, ábrela y cambia la fecha.
      </p>
    </>
  )
}

function SessionChip({ s, compact, onClick, onEdit }: { s: TrainingSession; compact: boolean; onClick: () => void; onEdit: () => void }) {
  const meta = SESSION_TYPES[s.type]
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/session-id', s.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'group/chip relative rounded-md text-left text-xs transition-opacity cursor-grab active:cursor-grabbing',
        DISCIPLINE_STYLE[meta.discipline],
        s.status === 'skipped' && 'opacity-50 line-through',
      )}
    >
      <button type="button" onClick={onClick} className="w-full px-1.5 py-1 text-left cursor-pointer" title={`${meta.label} · ${STATUS_LABEL[s.status]}`}>
        <span className="flex items-center gap-1 font-medium">
          {s.status === 'completed' ? <CheckCircle2 className="size-3 shrink-0" aria-label="Completada" /> : <meta.icon className="size-3 shrink-0" aria-hidden />}
          <span className="truncate">{compact ? meta.short : meta.label}</span>
        </span>
        {!compact && (
          <>
            {s.type !== 'rest' && <span className="block opacity-80">{s.time} · {s.durationMin} min</span>}
            {s.objective && <span className="mt-0.5 line-clamp-2 block text-[11px] opacity-80">{s.objective}</span>}
            <span className="mt-1 flex flex-wrap gap-1">
              {s.unplanned && <Badge className="bg-background/60 px-1 py-0 text-[10px]">No planificada</Badge>}
              {s.status === 'in_progress' && <Badge className="bg-background/60 px-1 py-0 text-[10px]">En curso</Badge>}
            </span>
          </>
        )}
      </button>
      {!compact && (
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-1 top-1 rounded bg-background/60 px-1 text-[10px] opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 cursor-pointer"
        >
          Editar
        </button>
      )}
    </div>
  )
}
