import { useState } from 'react'
import { Lock, Play, Sparkles } from 'lucide-react'
import { useExercises, useProfile, useRoutines } from '@/data'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/misc'
import { todayISO } from '@/lib/dates'
import { useSessionDialogs } from '@/features/training/SessionDialogs'
import { SuggestionHint, useNextSuggestion } from './progression'

/** What to lift next time for each exercise of a routine, calculated from the last sessions. */
export function NextSessionCard() {
  const routines = useRoutines()
  const exercises = useExercises()
  const profile = useProfile()
  const dialogs = useSessionDialogs()
  const suggest = useNextSuggestion()
  const unit = profile.settings.weightUnit
  const [chosen, setChosen] = useState('')
  const routine = routines.find((r) => r.id === chosen) ?? routines[0]

  if (!routine) return <EmptyState icon={<Sparkles />} title="Sin rutinas" description="Crea una rutina en «Rutinas y ejercicios» para calcular tu siguiente sesión." />

  return (
    <Card>
      <CardHeader
        title="Siguiente sesión"
        description="Peso y repeticiones calculados a partir de la última vez que hiciste cada ejercicio"
        icon={<Sparkles />}
      />
      <CardContent className="space-y-3">
        <Select aria-label="Rutina" className="h-9 sm:w-auto" value={routine.id} onChange={(e) => setChosen(e.target.value)}>
          {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        {routine.items.map((it, i) => {
          const ex = exercises.find((e) => e.id === it.exerciseId)
          if (!ex) return null
          const locked = ex.upperBody && !profile.shoulder.loadsAuthorized
          const s = suggest(ex.id, { sets: it.sets, reps: it.reps, rir: it.rir, weightKg: it.weightKg }, { before: todayISO() })
          return (
            <div key={`${ex.id}-${i}`} className="space-y-1.5">
              <p className="text-sm font-medium">
                {ex.name} <span className="text-xs font-normal text-muted-foreground">· {ex.muscleGroup}</span>
              </p>
              {locked ? (
                <p className="flex items-center gap-1.5 text-xs text-warning"><Lock className="size-3.5" /> Requiere autorización médica para cargas de tren superior.</p>
              ) : (
                s && <SuggestionHint suggestion={s} unit={unit} />
              )}
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground">
          Regla: si completas todas las series con el margen previsto (RIR), sube 2,5 kg (1 kg si pesa menos de 20 kg); si llegas justo, repite;
          si te faltan 1–2 repeticiones, repite y complétalas; si te quedas lejos, baja ~10 %. Con la recuperación en rojo nunca sube.
        </p>
        <Button onClick={() => dialogs.log({ sessionId: null, type: 'gym', routineId: routine.id })}>
          <Play /> Registrar con esta propuesta
        </Button>
      </CardContent>
    </Card>
  )
}
