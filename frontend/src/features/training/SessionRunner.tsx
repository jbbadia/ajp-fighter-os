import { useState } from 'react'
import { z } from 'zod'
import { CheckCircle2, Circle, Play, SkipForward, Square } from 'lucide-react'
import type { TrainingSession } from '@/types/domain'
import { sessionStore, useProfile, useSessions } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, ScaleInput, Textarea } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { clearanceWarning } from '@/domain/recovery'
import { hasDetailedLog, INTENSITY_LABEL, SESSION_TYPES } from '@/domain/sessionMeta'
import { requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { fmt } from '@/lib/dates'
import { formatMinutes } from '@/lib/units'
import { SkipDialog } from '@/features/training/SkipDialog'
import { cn, nowISO } from '@/lib/utils'
import { clock, useElapsed } from './timer'
import { GymWorkout } from '@/features/gym/GymWorkout'

/**
 * Run a session: start a live timer, tick off activities, then log duration + RPE.
 * The session id is passed (not the object) so the dialog always shows the live record.
 */
export function SessionRunner({
  sessionId,
  onClose,
  onFinishDetailed,
}: {
  sessionId: string | null
  onClose: () => void
  /** BJJ/gym/cardio sessions continue in their detailed log dialog. */
  onFinishDetailed: (session: TrainingSession, durationMin: number) => void
}) {
  const sessions = useSessions()
  const session = sessions.find((s) => s.id === sessionId)
  if (!session) return null
  if (SESSION_TYPES[session.type].discipline === 'gym')
    return <GymWorkout key={session.id} session={session} onClose={onClose} onLogManually={(s) => onFinishDetailed(s, s.durationMin)} />
  return <Runner key={session.id} session={session} onClose={onClose} onFinishDetailed={onFinishDetailed} />
}

function Runner({
  session,
  onClose,
  onFinishDetailed,
}: {
  session: TrainingSession
  onClose: () => void
  onFinishDetailed: (session: TrainingSession, durationMin: number) => void
}) {
  const profile = useProfile()
  const toast = useToast()
  const meta = SESSION_TYPES[session.type]
  const elapsed = useElapsed(session.startedAt)
  const warning = clearanceWarning(session.requiresClearance, profile.shoulder)

  const [step, setStep] = useState<'detail' | 'finish'>('detail')
  const [done, setDone] = useState<Set<number>>(new Set())
  const [duration, setDuration] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const start = () => sessionStore.update(session.id, { status: 'in_progress', startedAt: nowISO() })

  const goFinish = () => {
    const minutes = session.startedAt ? Math.max(1, Math.round(elapsed / 60)) : session.durationMin
    if (hasDetailedLog(session.type)) return onFinishDetailed(session, minutes)
    setDuration(String(minutes))
    setStep('finish')
  }

  const finish = () => {
    const schema = z.object({
      duration: requiredNumber('Duración', 1, 600),
      rpe: z.number({ error: 'Indica el RPE de la sesión' }).int().min(1).max(10),
    })
    const r = validate(schema, { duration, rpe })
    if (!r.ok) return setErrors(r.errors)
    sessionStore.update(session.id, {
      status: 'completed',
      result: { durationMin: Math.round(r.data.duration), rpe: r.data.rpe, notes: notes.trim(), completedAt: nowISO() },
    })
    toast('Sesión completada')
    onClose()
  }

  const [skipping, setSkipping] = useState(false)
  // Not done (can't go, class cancelled…) or remove it from the calendar.
  const skip = () => setSkipping(true)

  const toggle = (i: number) =>
    setDone((d) => {
      const n = new Set(d)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  const footer =
    step === 'finish' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('detail')}>Volver</Button>
        <Button onClick={finish}>
          <CheckCircle2 /> Guardar sesión
        </Button>
      </>
    ) : session.status === 'in_progress' ? (
      <Button onClick={goFinish} className="w-full sm:w-auto">
        <Square /> Finalizar
      </Button>
    ) : (
      <>
        <Button variant="ghost" className="px-3" aria-label="No voy / quitar" title="No voy / quitar" onClick={skip}>
          <SkipForward /> <span className="hidden sm:inline">No voy / quitar</span>
        </Button>
        <Button variant="secondary" className="px-3" onClick={goFinish}>
          <span className="sm:hidden">Ya hecha</span><span className="hidden sm:inline">Registrar ya hecha</span>
        </Button>
        <Button onClick={start}>
          <Play /> Comenzar
        </Button>
      </>
    )

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      title={`${meta.label} · ${session.objective}`}
      description={`${fmt(session.date, "EEEE d 'de' MMMM")} · ${session.time} · ${formatMinutes(session.durationMin)} · Intensidad ${INTENSITY_LABEL[session.intensity].toLowerCase()}`}
      footer={footer}
    >
      {step === 'detail' ? (
        <div className="space-y-4">
          {warning && <Alert severity="warning" title="Autorización médica pendiente">{warning}</Alert>}
          {session.status === 'in_progress' && (
            <div className="rounded-xl border border-primary/40 bg-accent p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-accent-foreground">En curso</p>
              <p className="font-display text-5xl font-bold tabular" aria-live="off">{clock(elapsed)}</p>
            </div>
          )}
          {session.description && <p className="text-sm text-muted-foreground">{session.description}</p>}
          {session.activities.length > 0 && (
            <ul className="space-y-1.5">
              {session.activities.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-muted cursor-pointer"
                  >
                    {done.has(i) ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    {(() => {
                      // "Title — detail": the detail (time, distance, reps) goes below in smaller text.
                      const [title, ...rest] = a.split(' — ')
                      return (
                        <span className={cn('min-w-0', done.has(i) && 'text-muted-foreground line-through')}>
                          <span className="font-medium">{title}</span>
                          {rest.length > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{rest.join(' — ')}</span>}
                        </span>
                      )
                    })()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="Duración real (min)" htmlFor="sr-dur" error={errors.duration}>
            <Input id="sr-dur" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label={`Esfuerzo percibido (RPE)${rpe ? ` · ${rpe}` : ''}`} error={errors.rpe}>
            <ScaleInput name="RPE" value={rpe} onChange={setRpe} lowLabel="Muy suave" highLabel="Máximo" />
          </Field>
          <Field label="Observaciones" htmlFor="sr-notes">
            <Textarea id="sr-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, molestias, aspectos técnicos…" />
          </Field>
        </div>
      )}
    </Dialog>
    {skipping && <SkipDialog session={session} onClose={() => setSkipping(false)} onDone={onClose} />}
    </>
  )
}
