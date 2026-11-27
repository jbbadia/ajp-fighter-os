import { Undo2 } from 'lucide-react'
import type { TrainingSession } from '@/types/domain'
import { sessionStore } from '@/data'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'

/** Puts a session back to "pending" (planned), e.g. after marking it done or not done by mistake. */
export function UndoSessionButton({ session, onDone }: { session: TrainingSession; onDone: () => void }) {
  const toast = useToast()
  if (session.status === 'planned') return null

  const undo = () => {
    if (session.unplanned && session.status === 'completed') {
      // An unplanned logged session has no plan to go back to: undoing it removes it.
      sessionStore.remove(session.id)
      toast('Registro eliminado')
    } else {
      sessionStore.update(session.id, { status: 'planned', startedAt: null, result: null, skipReason: null, bjj: null, gym: null, cardio: null })
      toast('Sesión de nuevo pendiente')
    }
    localStorage.removeItem(`ajp-fighter-os:workout:${session.id}`)
    onDone()
  }

  if (session.status === 'completed')
    return (
      <ConfirmButton
        variant="ghost"
        size="sm"
        title="Volver a pendiente"
        confirmLabel="Sí, deshacer"
        message={
          session.unplanned
            ? 'Era una sesión no planificada: se eliminará este registro.'
            : 'Se borrará lo que registraste en esta sesión (duración, RPE, series…) y volverá a quedar pendiente.'
        }
        onConfirm={undo}
      >
        <Undo2 /> <span className="hidden sm:inline">Volver a pendiente</span><span className="sm:hidden">Deshacer</span>
      </ConfirmButton>
    )

  return (
    <Button variant="ghost" size="sm" onClick={undo}>
      <Undo2 /> Volver a pendiente
    </Button>
  )
}
