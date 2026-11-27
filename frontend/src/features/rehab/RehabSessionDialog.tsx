import { useEffect, useState } from 'react'
import { Minus, Pause, Play, Plus, Save } from 'lucide-react'
import type { RehabSettings } from '@/types/domain'
import { profileStore, rehabStore } from '@/data'
import { PROFILE_ID } from '@/data/seed'
import { DERBY_S1, DERBY_S2, POSTERIOR_NOTE, S2_HOLDS, s1Achieved, s1Name, s2Achieved } from '@/domain/rehab'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

const num = (v: string) => Number(v.replace(',', '.').trim())

/** One rehab session: the current exercise of each section, with a rep counter and a hold stopwatch. */
export function RehabSessionDialog({ rehab, onClose }: { rehab: RehabSettings; onClose: () => void }) {
  const toast = useToast()
  const ex1 = DERBY_S1[rehab.s1]
  const ex2 = DERBY_S2[rehab.s2]
  const [reps, setReps] = useState(0)
  const [holds, setHolds] = useState<string[]>(Array.from({ length: S2_HOLDS }, () => ''))
  const [running, setRunning] = useState<{ index: number; since: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notes, setNotes] = useState('')

  const elapsed = running ? Math.floor((now - running.since) / 1000) : 0
  const nextHold = holds.findIndex((h) => h.trim() === '')

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      // The hold stops by itself at the target time (with vibration).
      if ((n - running.since) / 1000 >= ex2.target) {
        navigator.vibrate?.([250, 120, 250])
        setHolds((hs) => hs.map((h, i) => (i === running.index ? String(ex2.target) : h)))
        setRunning(null)
      }
    }, 200)
    return () => clearInterval(t)
  }, [running, ex2.target])

  const stop = (seconds: number) => {
    if (!running) return
    setHolds((hs) => hs.map((h, i) => (i === running.index ? String(seconds) : h)))
    setRunning(null)
  }

  const startHold = () => {
    if (nextHold < 0) return
    setNow(Date.now())
    setRunning({ index: nextHold, since: Date.now() })
  }

  const save = () => {
    const secs = holds.filter((h) => h.trim() !== '').map(num)
    if (secs.some((s) => !Number.isFinite(s) || s < 0 || s > 600)) return toast('Revisa los segundos de la sección 2', 'error')
    if (reps === 0 && secs.length === 0) return toast('Registra repeticiones o segundos antes de guardar', 'error')
    const log = {
      date: todayISO(),
      program: 'derby' as const,
      s1: reps > 0 ? { index: rehab.s1, reps } : null,
      s2: secs.length ? { index: rehab.s2, holds: secs.map((seconds) => ({ seconds: Math.round(seconds) })) } : null,
      notes: notes.trim(),
    }
    rehabStore.create(log)

    // Target reached → next exercise of that section (as the programme says).
    const next: Partial<RehabSettings> = {}
    const msgs: string[] = []
    if (s1Achieved(log) && rehab.s1 < DERBY_S1.length - 1) {
      next.s1 = rehab.s1 + 1
      msgs.push(`Sección 1 → ${s1Name(rehab.s1 + 1, rehab.variant)}`)
    }
    if (s2Achieved(log) && rehab.s2 < DERBY_S2.length - 1) {
      next.s2 = rehab.s2 + 1
      msgs.push(`Sección 2 → ${DERBY_S2[rehab.s2 + 1].name}`)
    }
    if (msgs.length) {
      profileStore.update(PROFILE_ID, { rehab: { ...rehab, ...next } })
      toast(`¡Objetivo conseguido! Siguiente ejercicio: ${msgs.join(' · ')}`)
    } else toast('Sesión de rehab guardada')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title="Sesión de rehab de hombro"
      description="Protocolo Derby · un ejercicio de cada sección"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}><Save /> Guardar sesión</Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sección 1 · ejercicio {rehab.s1 + 1} de {DERBY_S1.length}</p>
          <p className="font-semibold">{s1Name(rehab.s1, rehab.variant)}</p>
          <p className="text-xs text-muted-foreground">{ex1.how}</p>
          <p className="text-xs text-muted-foreground">Repeticiones hasta la fatiga o hasta el objetivo de <strong className="text-foreground">{ex1.target}</strong>.</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button size="icon" variant="secondary" aria-label="Quitar una repetición" onClick={() => setReps((r) => Math.max(0, r - 1))}><Minus /></Button>
            <div className="w-28 text-center">
              <p className={cn('font-display text-5xl font-bold tabular', reps >= ex1.target && 'text-good')} aria-live="polite">{reps}</p>
              <p className="text-xs text-muted-foreground">de {ex1.target}</p>
            </div>
            <Button size="icon" variant="secondary" aria-label="Sumar una repetición" onClick={() => setReps((r) => Math.min(1000, r + 1))}><Plus /></Button>
          </div>
          <div className="flex justify-center gap-2">
            {[5, 10, 25].map((n) => (
              <Button key={n} size="sm" variant="outline" onClick={() => setReps((r) => Math.min(1000, r + n))}>+{n}</Button>
            ))}
            <Input aria-label="Repeticiones" className="h-8 w-20 text-center" inputMode="numeric" value={String(reps)} onChange={(e) => setReps(Math.max(0, Math.min(1000, Math.round(num(e.target.value) || 0))))} />
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sección 2 · ejercicio {rehab.s2 + 1} de {DERBY_S2.length}</p>
          <p className="font-semibold">{ex2.name}</p>
          <p className="text-xs text-muted-foreground">{ex2.how}</p>
          {rehab.variant === 'posterior' && <p className="text-xs text-warning">{POSTERIOR_NOTE}</p>}
          <p className="text-xs text-muted-foreground">{S2_HOLDS} repeticiones de tu máximo, hasta <strong className="text-foreground">{ex2.target} s</strong> cada una. El cronómetro para solo a los {ex2.target} s.</p>
          <div className="flex items-center justify-center gap-3 py-1">
            <p className="font-display text-5xl font-bold tabular" aria-live="off">{running ? elapsed : nextHold < 0 ? '✓' : 0}<span className="text-lg text-muted-foreground"> s</span></p>
            {running ? (
              <Button onClick={() => stop(elapsed)}><Pause /> Parar</Button>
            ) : (
              <Button onClick={startHold} disabled={nextHold < 0}><Play /> {nextHold < 0 ? 'Hecho' : `Repetición ${nextHold + 1}`}</Button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {holds.map((h, i) => (
              <Field key={i} label={`Rep ${i + 1}`} htmlFor={`rh-${i}`}>
                <Input
                  id={`rh-${i}`}
                  className={cn('h-9 px-1 text-center', h !== '' && num(h) >= ex2.target && 'border-good/60')}
                  inputMode="numeric"
                  placeholder="s"
                  value={running?.index === i ? String(elapsed) : h}
                  disabled={running?.index === i}
                  onChange={(e) => setHolds((hs) => hs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </Field>
            ))}
          </div>
        </section>

        <Field label="Observaciones" htmlFor="rh-notes">
          <Textarea id="rh-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, dolor, inestabilidad… (coméntaselo a tu fisio)" />
        </Field>
      </div>
    </Dialog>
  )
}
