import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import type { SessionStatus, SessionType, TrainingSession } from '@/types/domain'
import { Input, Select } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/misc'
import { SESSION_TYPES, SESSION_TYPE_OPTIONS, STATUS_LABEL } from '@/domain/sessionMeta'
import { fmt } from '@/lib/dates'
import { formatMinutes } from '@/lib/units'
import { cn } from '@/lib/utils'
import { SessionTypeIcon } from '@/features/dashboard/widgets'
import { useSessionDialogs } from './SessionDialogs'

export interface SessionFilters {
  q: string
  type: SessionType | ''
  status: SessionStatus | ''
  from: string
  to: string
}

export const EMPTY_FILTERS: SessionFilters = { q: '', type: '', status: '', from: '', to: '' }

export function filterSessions(sessions: TrainingSession[], f: SessionFilters) {
  const q = f.q.trim().toLowerCase()
  return sessions.filter((s) => {
    if (f.type && s.type !== f.type) return false
    if (f.status && s.status !== f.status) return false
    if (f.from && s.date < f.from) return false
    if (f.to && s.date > f.to) return false
    if (q) {
      const hay = [s.objective, s.description, s.notes, s.result?.notes, SESSION_TYPES[s.type].label, ...s.activities]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function SessionFiltersBar({
  value,
  onChange,
  types,
}: {
  value: SessionFilters
  onChange: (f: SessionFilters) => void
  types?: SessionType[]
}) {
  const set = <K extends keyof SessionFilters>(k: K, v: SessionFilters[K]) => onChange({ ...value, [k]: v })
  const typeOptions = types ? SESSION_TYPE_OPTIONS.filter((o) => types.includes(o.value)) : SESSION_TYPE_OPTIONS
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative lg:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Buscar" placeholder="Buscar en objetivos, notas, actividades…" className="pl-9" value={value.q} onChange={(e) => set('q', e.target.value)} />
      </div>
      {typeOptions.length > 1 && (
        <Select aria-label="Tipo" value={value.type} onChange={(e) => set('type', e.target.value as SessionType | '')}>
          <option value="">Todos los tipos</option>
          {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )}
      <Select aria-label="Estado" value={value.status} onChange={(e) => set('status', e.target.value as SessionStatus | '')}>
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" aria-label="Desde" value={value.from} onChange={(e) => set('from', e.target.value)} />
        <Input type="date" aria-label="Hasta" value={value.to} onChange={(e) => set('to', e.target.value)} />
      </div>
    </div>
  )
}

/** Paginated, newest-first list of sessions; each row opens its dialog. */
export function SessionList({
  sessions,
  empty,
  detail,
  pageSize = 15,
}: {
  sessions: TrainingSession[]
  empty: ReactNode
  detail?: (s: TrainingSession) => ReactNode
  pageSize?: number
}) {
  const dialogs = useSessionDialogs()
  const [limit, setLimit] = useState(pageSize)
  const sorted = useMemo(() => [...sessions].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [sessions])

  if (!sorted.length) return <>{empty}</>
  return (
    <div>
      <ul className="divide-y divide-border">
        {sorted.slice(0, limit).map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => dialogs.open(s.id)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/40 cursor-pointer sm:px-2">
              <SessionTypeIcon session={s} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {SESSION_TYPES[s.type].label}
                  {s.objective && <span className="font-normal text-muted-foreground"> · {s.objective}</span>}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {fmt(s.date, 'EEE d MMM yyyy')} · {s.time} · {formatMinutes(s.result?.durationMin ?? s.durationMin)}
                  {s.result && ` · RPE ${s.result.rpe}`}
                </p>
                {detail && <div className="mt-1 text-xs text-muted-foreground">{detail(s)}</div>}
              </div>
              <span
                className={cn(
                  'hidden shrink-0 rounded-md px-2 py-0.5 text-xs sm:inline',
                  s.status === 'completed' ? 'bg-good/15 text-good' : s.status === 'skipped' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground',
                )}
              >
                {STATUS_LABEL[s.status]}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + pageSize)} className="mt-2 w-full rounded-lg py-2 text-sm text-primary hover:bg-muted cursor-pointer">
          Ver más ({sorted.length - limit} restantes)
        </button>
      )}
    </div>
  )
}

export function emptyList(icon: ReactNode, title: string, description: string, action?: ReactNode) {
  return <EmptyState icon={icon} title={title} description={description} action={action} />
}
