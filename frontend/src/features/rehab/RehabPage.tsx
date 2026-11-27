import { useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Flame, HandHelping, Play, Trash2 } from 'lucide-react'
import type { RehabSettings, RehabVariant } from '@/types/domain'
import { profileStore, rehabStore, useProfile, useRehabLogs } from '@/data'
import { PROFILE_ID } from '@/data/seed'
import {
  bestS1,
  bestS2,
  DEFAULT_REHAB,
  DERBY_S1,
  DERBY_S2,
  POSTERIOR_NOTE,
  rehabStreak,
  s1Achieved,
  s1Name,
  s2Achieved,
  sessionsOn,
  type RehabExercise,
} from '@/domain/rehab'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/form'
import { Alert, EmptyState, Progress } from '@/components/ui/misc'
import { fmt, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { RehabSessionDialog } from './RehabSessionDialog'

function useRehab(): RehabSettings {
  return useProfile().rehab ?? DEFAULT_REHAB
}

const setRehab = (rehab: RehabSettings, patch: Partial<RehabSettings>) => profileStore.update(PROFILE_ID, { rehab: { ...rehab, ...patch } })

export function RehabPage() {
  const rehab = useRehab()
  const logs = useRehabLogs()
  const [open, setOpen] = useState(false)
  const today = todayISO()
  const done = sessionsOn(logs, today)
  const streak = rehabStreak(logs, today)
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 15)

  return (
    <>
      <PageHeader
        title="Rehab hombro"
        description="Protocolo Derby de inestabilidad de hombro, pautado por tu fisio."
        actions={<Button onClick={() => setOpen(true)}><Play /> Hacer sesión</Button>}
      />
      <Alert severity="info" title="Pauta de tu fisioterapeuta" className="mb-4">
        Un ejercicio de cada sección a la vez; cuando consigues el objetivo pasas al siguiente. El documento indica dos sesiones al día, a la hora que quieras.
        Si aparece dolor o sensación de inestabilidad, para y coméntaselo a tu fisio.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Hoy" description={fmt(today, "EEEE d 'de' MMMM")} icon={<HandHelping />} />
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="font-display text-4xl font-bold tabular">
                {Math.min(done, rehab.sessionsPerDay)}/{rehab.sessionsPerDay}
                <span className="ml-2 text-sm font-normal text-muted-foreground">sesiones</span>
              </p>
              {streak > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Flame className="size-4 text-primary" /> {streak} {streak === 1 ? 'día' : 'días'} seguidos</p>
              )}
            </div>
            <Progress value={Math.min(100, (done / rehab.sessionsPerDay) * 100)} label="Sesiones de rehab de hoy" />
            <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
              <Play /> {done >= rehab.sessionsPerDay ? 'Hacer otra sesión' : `Hacer sesión ${done + 1}`}
            </Button>
          </CardContent>
        </Card>

        <SectionCard
          title="Sección 1 · Velocidad y pliometría"
          subtitle="Repeticiones hasta la fatiga o el objetivo"
          list={DERBY_S1}
          current={rehab.s1}
          unit="reps"
          nameOf={(i) => s1Name(i, rehab.variant)}
          best={bestS1(logs, rehab.s1)}
          onMove={(i) => setRehab(rehab, { s1: i })}
        />
        <SectionCard
          title="Sección 2 · Propiocepción y estabilidad"
          subtitle="5 repeticiones de tu máximo, hasta 60 s"
          list={DERBY_S2}
          current={rehab.s2}
          unit="s"
          nameOf={(i) => DERBY_S2[i].name}
          best={bestS2(logs, rehab.s2)}
          onMove={(i) => setRehab(rehab, { s2: i })}
          note={rehab.variant === 'posterior' ? POSTERIOR_NOTE : undefined}
        />

        <Card>
          <CardHeader title="Ajustes del fisio" description="Según lo que te haya indicado" />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de inestabilidad" htmlFor="rb-var" hint="Cambia el ejercicio 4 de la sección 1 (AER / AIR).">
              <Select id="rb-var" value={rehab.variant ?? ''} onChange={(e) => setRehab(rehab, { variant: (e.target.value || null) as RehabVariant | null })}>
                <option value="">Sin indicar</option>
                <option value="anterior">Anterior (AER)</option>
                <option value="posterior">Posterior (AIR)</option>
              </Select>
            </Field>
            <Field label="Sesiones al día" htmlFor="rb-spd">
              <Select id="rb-spd" value={String(rehab.sessionsPerDay)} onChange={(e) => setRehab(rehab, { sessionsPerDay: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historial" description="Últimas sesiones" />
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState icon={<HandHelping />} title="Sin sesiones todavía" description="Pulsa «Hacer sesión» para registrar la primera." />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{fmt(l.date, 'EEE d MMM')}</p>
                      {l.s1 && (
                        <p className="text-xs text-muted-foreground">
                          S1 · {s1Name(l.s1.index, rehab.variant)}: <span className={cn('tabular', s1Achieved(l) && 'text-good')}>{l.s1.reps}/{DERBY_S1[l.s1.index].target}</span>
                        </p>
                      )}
                      {l.s2 && (
                        <p className="text-xs text-muted-foreground">
                          S2 · {DERBY_S2[l.s2.index].name}: <span className={cn('tabular', s2Achieved(l) && 'text-good')}>{l.s2.holds.map((h) => `${h.seconds}s`).join(' · ')}</span>
                        </p>
                      )}
                      {l.notes && <p className="text-xs italic text-muted-foreground">{l.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Eliminar sesión" onClick={() => rehabStore.remove(l.id)}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {open && <RehabSessionDialog rehab={rehab} onClose={() => setOpen(false)} />}
    </>
  )
}

function SectionCard({
  title,
  subtitle,
  list,
  current,
  unit,
  nameOf,
  best,
  onMove,
  note,
}: {
  title: string
  subtitle: string
  list: RehabExercise[]
  current: number
  unit: 'reps' | 's'
  nameOf: (i: number) => string
  best: number | null
  onMove: (i: number) => void
  note?: string
}) {
  const ex = list[current]
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-primary/50 bg-accent/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ahora · ejercicio {current + 1} de {list.length}</p>
          <p className="font-semibold">{nameOf(current)}</p>
          <p className="text-[11px] text-muted-foreground">{ex.original}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ex.how}</p>
          {note && <p className="mt-1 text-xs text-warning">{note}</p>}
          <p className="mt-2 text-sm">
            Objetivo: <strong>{ex.target} {unit}</strong>
            {best !== null && <span className="text-muted-foreground"> · tu mejor: {best} {unit}</span>}
          </p>
        </div>
        <ol className="space-y-1">
          {list.map((_, i) => (
            <li key={i} className={cn('flex items-center gap-2 text-sm', i === current ? 'font-medium' : 'text-muted-foreground')}>
              {i < current ? <CheckCircle2 className="size-4 shrink-0 text-good" /> : <Circle className={cn('size-4 shrink-0', i === current && 'text-primary')} />}
              <span className="flex-1">{nameOf(i)}</span>
              <span className="tabular text-xs">{list[i].target} {unit}</span>
            </li>
          ))}
        </ol>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => onMove(current - 1)}><ChevronLeft /> Anterior</Button>
          <Button size="sm" variant="ghost" disabled={current === list.length - 1} onClick={() => onMove(current + 1)}>Siguiente <ChevronRight /></Button>
        </div>
      </CardContent>
    </Card>
  )
}
