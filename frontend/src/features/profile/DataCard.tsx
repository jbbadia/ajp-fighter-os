import { useRef, useState } from 'react'
import { Database, Download, LogOut, Upload } from 'lucide-react'
import { ALL_STORES, useSessions } from '@/data'
import { buildBackup, restoreBackup } from '@/data/backup'
import { DATA_MODE } from '@/data/adapters'
import { logout, useAuth } from '@/data/auth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { download, sessionsCSV } from '@/lib/export'
import { todayISO } from '@/lib/dates'

export function DataCard() {
  const toast = useToast()
  const sessions = useSessions()
  const auth = useAuth()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const counts = Object.entries(ALL_STORES).reduce((a, [, s]) => a + s.getSnapshot().length, 0)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return toast('El archivo es demasiado grande', 'error')
    setPending(await f.text())
    if (file.current) file.current.value = ''
  }

  const confirmRestore = async () => {
    const raw = pending!
    setPending(null)
    try {
      await restoreBackup(raw)
      toast('Copia de seguridad restaurada')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo restaurar', 'error')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Datos y cuenta"
        description={DATA_MODE === 'api' ? `Guardado en el servidor${auth.status === 'authenticated' && auth.user.email ? ` · ${auth.user.email}` : ''}` : 'Modo local: datos guardados en este navegador'}
        icon={<Database />}
      />
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{counts} registros en total.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => download(`ajp-backup-${todayISO()}.json`, JSON.stringify(buildBackup(), null, 2), 'application/json')}>
            <Download /> Copia de seguridad
          </Button>
          <Button variant="secondary" onClick={() => file.current?.click()}><Upload /> Restaurar copia</Button>
          <Button variant="secondary" onClick={() => download(`ajp-entrenamientos-${todayISO()}.csv`, sessionsCSV(sessions))}><Download /> Entrenamientos CSV</Button>
          {DATA_MODE === 'api' && <Button variant="ghost" onClick={logout}><LogOut /> Cerrar sesión</Button>}
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </CardContent>
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Restaurar copia de seguridad"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRestore}>Reemplazar mis datos</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Todos tus datos actuales se sustituirán por los de la copia. Te recomendamos descargar antes una copia de los datos actuales.</p>
      </Dialog>
    </Card>
  )
}
