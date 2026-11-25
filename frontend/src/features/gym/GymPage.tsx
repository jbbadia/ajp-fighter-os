import { useState } from 'react'
import { Dumbbell, Medal, Plus, TrendingUp } from 'lucide-react'
import { useExercises, useProfile, useSessions } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { Select } from '@/components/ui/form'
import { Alert, EmptyState } from '@/components/ui/misc'
import { BarTrend, LineTrend } from '@/components/charts/TrendChart'
import { exerciseHistory, loggedExerciseIds, personalRecords, weeklyVolume } from '@/domain/gymStats'
import { hasAny } from '@/domain/metrics'
import { fmt } from '@/lib/dates'
import { formatWeight, kgToUnit } from '@/lib/units'
import { round } from '@/lib/utils'
import { useSessionDialogs } from '@/features/training/SessionDialogs'
import { EMPTY_FILTERS, filterSessions, SessionFiltersBar, SessionList } from '@/features/training/SessionList'
import { ExerciseCatalog, RoutineManager } from './GymCatalog'

type Tab = 'sessions' | 'progress' | 'routines'

export function GymPage() {
  const sessions = useSessions()
  const exercises = useExercises()
  const profile = useProfile()
  const dialogs = useSessionDialogs()
  const unit = profile.settings.weightUnit
  const [tab, setTab] = useState<Tab>('sessions')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const gym = sessions.filter((s) => s.type === 'gym')
  const logged = loggedExerciseIds(sessions)
  const [exerciseId, setExerciseId] = useState<string>('')
  const selected = exerciseId || logged[0] || ''
  const history = selected ? exerciseHistory(sessions, selected) : []
  const prs = personalRecords(sessions)
  const volume = weeklyVolume(sessions)

  return (
    <>
      <PageHeader
        title="Gimnasio"
        description="Rutinas, series, cargas y progresión de fuerza."
        actions={<Button onClick={() => dialogs.log({ sessionId: null, type: 'gym' })}><Plus /> Registrar sesión</Button>}
      />
      {!profile.shoulder.loadsAuthorized && (
        <Alert severity="warning" title="Tren superior condicionado a autorización médica" className="mb-4">
          Los ejercicios que cargan el hombro están bloqueados hasta que registres la autorización en tu perfil.
        </Alert>
      )}
      <Tabs className="mb-4" value={tab} onChange={setTab} options={[
        { value: 'sessions', label: 'Sesiones' },
        { value: 'progress', label: 'Progreso y récords' },
        { value: 'routines', label: 'Rutinas y ejercicios' },
      ]} />

      {tab === 'sessions' && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <SessionFiltersBar value={filters} onChange={setFilters} types={['gym']} />
            <SessionList
              sessions={filterSessions(gym, filters)}
              detail={(s) => (s.gym ? s.gym.exercises.map((e) => `${e.name} ${e.sets.length}×`).join(' · ') : null)}
              empty={<EmptyState icon={<Dumbbell />} title="Sin sesiones de gimnasio" description="Registra tu primera sesión con series, cargas y RIR." />}
            />
          </CardContent>
        </Card>
      )}

      {tab === 'progress' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Evolución de cargas"
              description="Peso de la mejor serie por sesión"
              icon={<TrendingUp />}
              action={
                logged.length > 0 && (
                  <Select aria-label="Ejercicio" className="h-9 w-auto" value={selected} onChange={(e) => setExerciseId(e.target.value)}>
                    {logged.map((id) => <option key={id} value={id}>{exercises.find((e) => e.id === id)?.name ?? prs.find((p) => p.exerciseId === id)?.name}</option>)}
                  </Select>
                )
              }
            />
            <CardContent>
              {history.length >= 2 ? (
                <LineTrend
                  height={220}
                  data={history.map((h) => ({ label: h.label, value: round(kgToUnit(h.topWeight, unit), 1) }))}
                  format={(v) => `${v.toLocaleString('es-ES')} ${unit}`}
                  ariaLabel="Peso de la mejor serie por sesión"
                />
              ) : (
                <EmptyState icon={<TrendingUp />} title="Datos insuficientes" description="Registra este ejercicio en al menos 2 sesiones para ver su evolución." />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Volumen semanal" description={`Σ repeticiones × peso (${unit})`} icon={<Dumbbell />} />
            <CardContent>
              {hasAny(volume) ? (
                <BarTrend data={volume.map((v) => ({ ...v, value: round(kgToUnit(v.value, unit), 0) }))} format={(v) => `${v.toLocaleString('es-ES')} ${unit}`} ariaLabel="Volumen de gimnasio por semana" />
              ) : (
                <EmptyState icon={<Dumbbell />} title="Sin volumen registrado" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Récords personales" description="1RM estimado (Epley) solo con series de ≤ 12 repeticiones" icon={<Medal />} />
            <CardContent>
              {prs.length === 0 ? (
                <EmptyState icon={<Medal />} title="Sin récords todavía" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Ejercicio</th>
                      <th className="pb-2 font-medium">Máximo</th>
                      <th className="pb-2 font-medium">1RM est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {prs.map((p) => (
                      <tr key={p.exerciseId}>
                        <td className="py-2">{p.name}</td>
                        <td className="tabular py-2">
                          {formatWeight(p.maxWeight, unit)} × {p.repsAtMax}
                          <span className="block text-[11px] text-muted-foreground">{fmt(p.date, 'd MMM yyyy')}</span>
                        </td>
                        <td className="tabular py-2">{p.bestE1rm ? formatWeight(p.bestE1rm, unit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'routines' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RoutineManager />
          <ExerciseCatalog />
        </div>
      )}
    </>
  )
}
