import { useState } from 'react'
import { Download, History } from 'lucide-react'
import { useSessions } from '@/data'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { download, sessionsCSV } from '@/lib/export'
import { todayISO } from '@/lib/dates'
import { EMPTY_FILTERS, filterSessions, SessionFiltersBar, SessionList } from '@/features/training/SessionList'

export function HistoryPage() {
  const sessions = useSessions()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const filtered = filterSessions(sessions, filters)
  return (
    <>
      <PageHeader
        title="Historial"
        description="Todas tus sesiones, con búsqueda y filtros."
        actions={
          <Button variant="secondary" disabled={!filtered.length} onClick={() => download(`ajp-historial-${todayISO()}.csv`, sessionsCSV(filtered))}>
            <Download /> Exportar {filtered.length !== sessions.length ? 'filtrado' : 'todo'} (CSV)
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-3 pt-5">
          <SessionFiltersBar value={filters} onChange={setFilters} />
          <p className="text-xs text-muted-foreground">{filtered.length} de {sessions.length} sesiones</p>
          <SessionList
            pageSize={25}
            sessions={filtered}
            empty={<EmptyState icon={<History />} title="No hay sesiones que coincidan" description="Cambia los filtros o la búsqueda." />}
          />
        </CardContent>
      </Card>
    </>
  )
}
