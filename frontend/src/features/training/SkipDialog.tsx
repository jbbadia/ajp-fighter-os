import { useState } from 'react'
import { Ban, CalendarX2, HeartCrack, MoreHorizontal, Trash2, UserX } from 'lucide-react'
import type { SkipReason, TrainingSession } from '@/types/domain'
import { sessionStore } from '@/data'
import { SESSION_TYPES, SKIP_REASONS } from '@/domain/sessionMeta'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { fmt } from '@/lib/dates'
import { cn } from '@/lib/utils'

const ICON: Record<SkipReason, typeof Ban> = {
  cant_attend: UserX,
  class_cancelled: CalendarX2,
  injury: HeartCrack,
  other: MoreHorizontal,
}

/**
 * "Why not?" checklist for a session: mark it as not done with a reason
 * (can't go, class cancelled…) or remove it from the calendar altogether.
 */
export function SkipDialog({ session, onClose, onDone }: { session: TrainingSession; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState<SkipReason | null>(session.skipReason ?? null)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const draftKey = `ajp-fighter-os:workout:${session.id}`

  const skip = () => {
    if (!reason) return
    const extra = note.trim()
    sessionStore.update(session.id, {
      status: 'skipped',
      skipReason: reason,
      startedAt: null,
      notes: extra ? (session.notes ? `${session.notes}\n${extra}` : extra) : session.notes,
    })
    localStorage.removeItem(draftKey)
    toast(`Marcada como no realizada · ${SKIP_REASONS.find((r) => r.value === reason)!.label}`)
    onDone()
  }

  const remove = () => {
    sessionStore.remove(session.id)
    localStorage.removeItem(draftKey)
    toast('Sesión eliminada del calendario')
    onDone()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="¿Qué pasa con esta sesión?"
      description={`${SESSION_TYPES[session.type].label} · ${fmt(session.date, "EEEE d 'de' MMMM")} · ${session.time}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Volver</Button>
          <Button disabled={!reason} onClick={skip}><Ban /> Marcar no realizada</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Motivo" className="grid gap-2 sm:grid-cols-2">
          {SKIP_REASONS.map((r) => {
            const Icon = ICON[r.value]
            const on = reason === r.value
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(r.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer',
                  on ? 'border-primary bg-accent text-foreground' : 'border-border hover:bg-muted',
                )}
              >
                <Icon className={cn('size-5 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                {r.label}
              </button>
            )
          })}
        </div>
        <Field label="Nota (opcional)" htmlFor="sk-note">
          <Textarea id="sk-note" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: trabajo, viaje, el profe avisó…" />
        </Field>

        <div className="rounded-xl border border-critical/30 p-3">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">¿Eliminarla del calendario? No queda registro.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>No</Button>
                <Button size="sm" variant="destructive" onClick={remove}><Trash2 /> Sí, eliminar</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-2 text-sm text-critical cursor-pointer">
              <Trash2 className="size-4" /> Eliminar del calendario
              <span className="ml-auto text-xs text-muted-foreground">si no tenía que estar</span>
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
