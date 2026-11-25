import type { TrainingSession } from '@/types/domain'
import { fmt } from '@/lib/dates'
import { sum } from '@/lib/utils'

export function bjjSessions(sessions: TrainingSession[]) {
  return sessions.filter((s) => s.type === 'bjj_gi' || s.type === 'bjj_nogi')
}

/** Aggregates the sparring rounds the athlete has logged. */
export function sparringSummary(sessions: TrainingSession[]) {
  const logged = bjjSessions(sessions).filter((s) => s.status === 'completed' && s.bjj)
  const rounds = logged.flatMap((s) => s.bjj!.sparring)
  const total = <K extends 'submissionsAttempted' | 'submissionsReceived' | 'guardPasses' | 'sweeps' | 'takedowns'>(k: K) =>
    sum(rounds.map((r) => r[k]))
  return {
    sessions: logged.length,
    rounds: rounds.length,
    wins: rounds.filter((r) => r.result === 'win').length,
    losses: rounds.filter((r) => r.result === 'loss').length,
    draws: rounds.filter((r) => r.result === 'draw').length,
    submissionsAttempted: total('submissionsAttempted'),
    submissionsReceived: total('submissionsReceived'),
    guardPasses: total('guardPasses'),
    sweeps: total('sweeps'),
    takedowns: total('takedowns'),
    sparringMinutes: sum(rounds.map((r) => r.durationMin)),
    recentMistakes: logged
      .flatMap((s) => s.bjj!.sparring.filter((r) => r.mistakes).map((r) => ({ date: s.date, text: r.mistakes })))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
    recentPositives: logged
      .flatMap((s) => s.bjj!.sparring.filter((r) => r.positives).map((r) => ({ date: s.date, text: r.positives })))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
  }
}

export function technicalQualitySeries(sessions: TrainingSession[]) {
  return bjjSessions(sessions)
    .filter((s) => s.status === 'completed' && s.bjj?.technicalQuality != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ label: fmt(s.date, 'd MMM'), value: s.bjj!.technicalQuality! }))
}

export function giNoGiMinutes(sessions: TrainingSession[], from?: string) {
  const done = bjjSessions(sessions).filter((s) => s.status === 'completed' && (!from || s.date >= from))
  const min = (t: string) => sum(done.filter((s) => s.type === t).map((s) => s.result?.durationMin ?? s.durationMin))
  return { gi: min('bjj_gi'), nogi: min('bjj_nogi') }
}
