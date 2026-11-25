import { useState } from 'react'
import { Activity, Gauge, HeartPulse, Plus, Timer, TrendingUp } from 'lucide-react'
import { useSessions } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { BarTrend, LineTrend } from '@/components/charts/TrendChart'
import { cardioRpeSeries, hrSeries, isCardio, z2SpeedSeries, zoneTotals } from '@/domain/cardioStats'
import { hasAny, weeklyCardioMinutes } from '@/domain/metrics'
import { CARDIO_KIND_LABEL } from '@/domain/sessionMeta'
import { formatMinutes } from '@/lib/units'
import { useSessionDialogs } from '@/features/training/SessionDialogs'
import { EMPTY_FILTERS, filterSessions, SessionFiltersBar, SessionList } from '@/features/training/SessionList'

export function CardioPage() {
  const sessions = useSessions()
  const dialogs = useSessionDialogs()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const cardio = sessions.filter(isCardio)
  const weekly = weeklyCardioMinutes(sessions)
  const hr = hrSeries(sessions)
  const speed = z2SpeedSeries(sessions)
  const rpe = cardioRpeSeries(sessions)
  const zones = zoneTotals(sessions)

  const need = (n: number) => <p className="text-xs text-muted-foreground">Se necesitan al menos {n} sesiones con este dato.</p>

  return (
    <>
      <PageHeader
        title="Cardio"
        description="Zona 2, HIIT y cardio específico de BJJ. Solo datos que registras, sin estimaciones fisiológicas."
        actions={
          <>
            <Button variant="secondary" onClick={() => dialogs.log({ sessionId: null, type: 'hiit' })}><Plus /> HIIT</Button>
            <Button onClick={() => dialogs.log({ sessionId: null, type: 'cardio_z2' })}><Plus /> Registrar cardio</Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Volumen semanal" description="Minutos de cardio completados" icon={<Timer />} />
          <CardContent>
            {hasAny(weekly) ? <BarTrend data={weekly} format={formatMinutes} ariaLabel="Minutos de cardio por semana" /> : <EmptyState icon={<Timer />} title="Sin sesiones completadas" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Frecuencia cardíaca media" description="Por sesión (lpm)" icon={<HeartPulse />} />
          <CardContent>{hr.length >= 2 ? <LineTrend data={hr} domainPadding={5} format={(v) => `${v} lpm`} ariaLabel="Frecuencia cardíaca media por sesión" /> : need(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Capacidad aeróbica" description="Velocidad media en sesiones de Zona 2 (km/h). Compara con la misma máquina." icon={<TrendingUp />} />
          <CardContent>{speed.length >= 2 ? <LineTrend data={speed} format={(v) => `${v} km/h`} ariaLabel="Velocidad media en Zona 2" /> : need(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Evolución del RPE" description="Esfuerzo percibido por sesión" icon={<Gauge />} />
          <CardContent>{rpe.length >= 2 ? <LineTrend data={rpe} format={(v) => `RPE ${v}`} ariaLabel="RPE por sesión de cardio" /> : need(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Tiempo en zonas" description={`Últimos 30 días · ${zones.sessions} sesiones con datos de zonas`} icon={<Activity />} />
          <CardContent>
            {zones.sessions > 0 ? <BarTrend data={zones.data} format={formatMinutes} ariaLabel="Minutos por zona de frecuencia cardíaca" /> : <p className="text-xs text-muted-foreground">Añade los minutos por zona al registrar una sesión, si tu dispositivo los proporciona.</p>}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Historial de cardio" icon={<HeartPulse />} />
        <CardContent className="space-y-3">
          <SessionFiltersBar value={filters} onChange={setFilters} types={['cardio_z2', 'hiit']} />
          <SessionList
            sessions={filterSessions(cardio, filters)}
            detail={(s) =>
              s.cardio
                ? [CARDIO_KIND_LABEL[s.cardio.kind], s.cardio.avgHr && `FC ${s.cardio.avgHr} lpm`, s.cardio.distanceKm && `${s.cardio.distanceKm} km`, s.cardio.intervals && `${s.cardio.intervals} intervalos`]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
            empty={<EmptyState icon={<HeartPulse />} title="Sin sesiones de cardio" description="Registra tu primera sesión de Zona 2 o HIIT." />}
          />
        </CardContent>
      </Card>
    </>
  )
}
