import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Cloud, CloudOff, ExternalLink, RefreshCw } from 'lucide-react'
import { connectSync, disconnectSync, probeCloud, suggestedRepo, syncNow, useSyncStatus } from '@/data/sync'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

const TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?name=AJP%20Fighter%20OS&description=Sincronizar%20datos%20entre%20dispositivos&expires_in=none&contents=write'

/** Connects this device to the athlete's private GitHub repository so PC and phone share the same data. */
export function SyncCard() {
  const toast = useToast()
  const status = useSyncStatus()
  const [repo, setRepo] = useState(suggestedRepo)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<{ records: number } | null>(null)

  const connect = async (mode: 'cloud' | 'merge') => {
    setChoice(null)
    setBusy(true)
    setError(null)
    try {
      await connectSync({ repo, token }, mode)
      setToken('')
      toast(mode === 'cloud' ? 'Conectado: este dispositivo ya tiene los datos de la nube' : 'Conectado y sincronizado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const cloud = await probeCloud({ repo, token })
      if (cloud.hasData) setChoice({ records: cloud.records })
      else await connect('merge')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar')
    } finally {
      setBusy(false)
    }
  }

  const last = status.lastSync ? format(parseISO(status.lastSync), "d MMM, HH:mm", { locale: es }) : null

  return (
    <Card>
      <CardHeader
        title="Sincronizar PC y móvil"
        description={status.configured ? `Conectado a ${status.repo}` : 'Registra desde cualquier dispositivo y verás lo mismo en todos'}
        icon={status.configured ? <Cloud /> : <CloudOff />}
      />
      <CardContent className="space-y-3">
        {status.configured ? (
          <>
            <p className="text-sm">
              {status.state === 'syncing' ? 'Sincronizando…' : status.state === 'error' ? 'Última sincronización con error' : last ? `Sincronizado · ${last}` : 'Pendiente de sincronizar'}
            </p>
            {status.state === 'error' && status.error && <Alert severity="warning" title="No se pudo sincronizar">{status.error}</Alert>}
            <p className="text-xs text-muted-foreground">Se sincroniza solo al hacer cambios, al volver a abrir la app y cada minuto. Necesita internet; sin conexión se guarda en el dispositivo y se envía después.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>
                <RefreshCw className={status.state === 'syncing' ? 'animate-spin' : undefined} /> Sincronizar ahora
              </Button>
              <Button variant="ghost" onClick={disconnectSync}><CloudOff /> Desconectar este dispositivo</Button>
            </div>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Crea un token en GitHub{' '}
                <a href={TOKEN_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  aquí <ExternalLink className="size-3" />
                </a>
                : en <em>Repository access</em> elige <em>Only select repositories</em> → tu repositorio de datos, y en <em>Permissions → Contents</em> pon <em>Read and write</em>.
              </li>
              <li>Pégalo abajo y pulsa Conectar. Haz lo mismo en el otro dispositivo (puedes usar el mismo token).</li>
            </ol>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Repositorio privado" htmlFor="sync-repo">
                <Input id="sync-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/ajp-fighter-os-datos" autoComplete="off" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
              </Field>
              <Field label="Token de GitHub" htmlFor="sync-token" hint="Se guarda solo en este dispositivo.">
                <Input id="sync-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
              </Field>
            </div>
            {error && <Alert severity="critical" title="No se pudo conectar">{error}</Alert>}
            <Button disabled={busy || !repo.trim() || !token.trim()} onClick={() => void start()}>
              <Cloud /> {busy ? 'Conectando…' : 'Conectar'}
            </Button>
          </>
        )}
      </CardContent>
      <Dialog
        open={choice !== null}
        onClose={() => setChoice(null)}
        title="Ya hay datos en la nube"
        footer={
          <>
            <Button variant="ghost" onClick={() => void connect('merge')}>Combinar ambos</Button>
            <Button onClick={() => void connect('cloud')}>Usar los de la nube</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>La nube tiene {choice?.records ?? 0} registros de otro dispositivo.</p>
          <p><strong className="text-foreground">Usar los de la nube</strong> (recomendado si este dispositivo es nuevo): este dispositivo pasa a tener exactamente esos datos y se descartan los suyos.</p>
          <p><strong className="text-foreground">Combinar ambos</strong>: se juntan los registros de los dos; las sesiones planificadas iniciales podrían quedar duplicadas.</p>
        </div>
      </Dialog>
    </Card>
  )
}
