import { useState } from 'react'
import { BookOpen, Plus, Swords, Target, TrendingUp } from 'lucide-react'
import { useSessions } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/misc'
import { LineTrend } from '@/components/charts/TrendChart'
import { bjjSessions, giNoGiMinutes, sparringSummary, technicalQualitySeries } from '@/domain/bjjStats'
import { fmt } from '@/lib/dates'
import { formatHours } from '@/lib/units'
import { useSessionDialogs } from '@/features/training/SessionDialogs'
import { EMPTY_FILTERS, filterSessions, SessionFiltersBar, SessionList } from '@/features/training/SessionList'
import { StatTile } from '@/features/dashboard/widgets'
import { TechniqueLibrary } from './TechniqueLibrary'

type Tab = 'sessions' | 'sparring' | 'library'

export function BjjPage() {
  const sessions = useSessions()
  const dialogs = useSessionDialogs()
  const [tab, setTab] = useState<Tab>('sessions')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const bjj = bjjSessions(sessions)
  const stats = sparringSummary(sessions)
  const quality = technicalQualitySeries(sessions)
  const split = giNoGiMinutes(sessions)

  return (
    <>
      <PageHeader
        title="BJJ"
        description="Sesiones Gi y No-Gi, sparring round a round y biblioteca técnica."
        actions={<Button onClick={() => dialogs.log({ sessionId: null, type: 'bjj_gi' })}><Plus /> Registrar sesión BJJ</Button>}
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sessions', label: 'Sesiones' },
          { value: 'sparring', label: 'Sparring' },
          { value: 'library', label: 'Biblioteca técnica' },
        ]}
      />

      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Sesiones completadas" icon={<Swords />} value={bjj.filter((s) => s.status === 'completed').length} />
            <StatTile label="Horas Gi" icon={<Swords />} value={formatHours(split.gi)} unit="h" />
            <StatTile label="Horas No-Gi" icon={<Swords />} value={formatHours(split.nogi)} unit="h" />
            <StatTile label="Rounds registrados" icon={<Target />} value={stats.rounds} />
          </div>
          <Card>
            <CardContent className="space-y-3 pt-5">
              <SessionFiltersBar value={filters} onChange={setFilters} types={['bjj_gi', 'bjj_nogi']} />
              <SessionList
                sessions={filterSessions(bjj, filters)}
                detail={(s) =>
                  s.bjj ? `${s.bjj.rounds} rounds · ${s.bjj.partners} compañeros${s.bjj.technicalQuality ? ` · técnica ${s.bjj.technicalQuality}/10` : ''}` : null
                }
                empty={<EmptyState icon={<Swords />} title="Sin sesiones de BJJ" description="Registra tu primera sesión o complétala desde el calendario." />}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'sparring' && (
        stats.rounds === 0 ? (
          <EmptyState
            icon={<Target />}
            title="Sin rounds de sparring registrados"
            description="Al registrar una sesión de BJJ, añade tus rounds para ver aquí tus estadísticas."
            action={<Button onClick={() => dialogs.log({ sessionId: null, type: 'bjj_gi' })}><Plus /> Registrar sesión</Button>}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <StatTile label="Rounds" icon={<Target />} value={stats.rounds} />
              <StatTile label="V / D / E" icon={<Target />} value={`${stats.wins}/${stats.losses}/${stats.draws}`} />
              <StatTile label="Sumisiones hechas" icon={<Target />} value={stats.submissionsAttempted} sub="intentadas" />
              <StatTile label="Sumisiones recibidas" icon={<Target />} value={stats.submissionsReceived} />
              <StatTile label="Pases" icon={<Target />} value={stats.guardPasses} />
              <StatTile label="Barridos" icon={<Target />} value={stats.sweeps} />
              <StatTile label="Derribos" icon={<Target />} value={stats.takedowns} />
              <StatTile label="Min. de sparring" icon={<Target />} value={Math.round(stats.sparringMinutes)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title="Calidad técnica" description="Valoración por sesión (1-10)" icon={<TrendingUp />} />
                <CardContent>
                  {quality.length >= 2 ? (
                    <LineTrend data={quality} format={(v) => `${v}/10`} ariaLabel="Calidad técnica por sesión" />
                  ) : (
                    <p className="text-xs text-muted-foreground">Se necesita al menos 2 sesiones con calidad técnica.</p>
                  )}
                </CardContent>
              </Card>
              <NotesCard title="Errores recientes" items={stats.recentMistakes} />
              <NotesCard title="Aspectos positivos" items={stats.recentPositives} />
            </div>
          </div>
        )
      )}

      {tab === 'library' && <TechniqueLibrary />}
    </>
  )
}

function NotesCard({ title, items }: { title: string; items: { date: string; text: string }[] }) {
  return (
    <Card>
      <CardHeader title={title} icon={<BookOpen />} />
      <CardContent>
        {items.length ? (
          <ul className="space-y-2 text-sm">
            {items.map((m, i) => (
              <li key={i}>
                <span className="text-xs text-muted-foreground">{fmt(m.date, 'd MMM')} · </span>
                {m.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin anotaciones todavía.</p>
        )}
      </CardContent>
    </Card>
  )
}
