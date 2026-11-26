import { ArrowDown, ArrowUp, Equal, Pause, Sparkles } from 'lucide-react'
import type { SetLog } from '@/types/domain'
import { useDailyLogs, useProfile, useSessions } from '@/data'
import { suggestNext, type NextAction, type NextSuggestion, type NextTarget } from '@/domain/gymStats'
import { assessRecovery } from '@/domain/recovery'
import { fmt } from '@/lib/dates'
import { formatWeight } from '@/lib/units'
import { cn } from '@/lib/utils'

/** Returns a function that proposes the next sets for an exercise from the athlete's own history. */
export function useNextSuggestion() {
  const sessions = useSessions()
  const logs = useDailyLogs()
  const unit = useProfile().settings.weightUnit
  const holdIncrease = assessRecovery(logs).level === 'red'
  return (exerciseId: string, target: NextTarget | null, opts: { before?: string; excludeId?: string } = {}) =>
    suggestNext(sessions, exerciseId, target, { ...opts, holdIncrease, formatWeight: (kg) => formatWeight(kg, unit) })
}

const ICON: Record<NextAction, typeof ArrowUp> = {
  first: Sparkles,
  increase: ArrowUp,
  repeat: Equal,
  more_reps: Equal,
  decrease: ArrowDown,
  hold_recovery: Pause,
}

export function summarizeSets(sets: SetLog[], unit: 'kg' | 'lb'): string {
  return sets.map((s) => (s.weightKg > 0 ? `${formatWeight(s.weightKg, unit, false)}×${s.reps}` : `${s.reps} rep${s.reps === 1 ? '' : 's'}`)).join(' · ')
}

export function proposalText(s: NextSuggestion, unit: 'kg' | 'lb'): string {
  const load = s.weightKg === null ? 'peso a elegir' : s.weightKg === 0 ? 'peso corporal' : formatWeight(s.weightKg, unit)
  return `${s.sets}×${s.reps} · ${load}${s.rir !== null ? ` · RIR ${s.rir}` : ''}`
}

/** One-line proposal plus why, shown under each exercise. */
export function SuggestionHint({ suggestion, unit, className }: { suggestion: NextSuggestion; unit: 'kg' | 'lb'; className?: string }) {
  const Icon = ICON[suggestion.action]
  const tone =
    suggestion.action === 'increase' ? 'text-good' : suggestion.action === 'decrease' || suggestion.action === 'hold_recovery' ? 'text-warning' : 'text-muted-foreground'
  return (
    <div className={cn('rounded-md bg-muted/50 px-2.5 py-2 text-xs', className)}>
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden /> Propuesta: {proposalText(suggestion, unit)}
      </p>
      <p className="mt-0.5 text-muted-foreground">{suggestion.reason}</p>
      {suggestion.last && (
        <p className="mt-0.5 text-muted-foreground">
          Última vez ({fmt(suggestion.last.date, 'd MMM')}): {summarizeSets(suggestion.last.sets, unit)}
        </p>
      )}
    </div>
  )
}
