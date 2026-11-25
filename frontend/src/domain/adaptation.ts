import type { DailyLog, Intensity, ShoulderStatus, TrainingSession } from '@/types/domain'
import { addDays, fromISODate, todayISO, toISODate } from '@/lib/dates'
import { assessRecovery, shoulderAlerts } from './recovery'
import { SESSION_TYPES } from './sessionMeta'

/**
 * Plan adaptation engine. Produces *suggestions*; nothing changes until the athlete applies one.
 * Rules are conservative load-management heuristics, never medical advice.
 */
export interface Adjustment {
  id: string
  kind: 'reduce' | 'recover' | 'clearance' | 'missed'
  title: string
  detail: string
  sessionId: string
  /** Patch applied to the session when accepted. */
  patch: Partial<TrainingSession>
}

const STEP_DOWN: Record<Intensity, Intensity> = { high: 'moderate', moderate: 'low', low: 'low' }

export function suggestAdjustments(
  sessions: TrainingSession[],
  logs: DailyLog[],
  shoulder: ShoulderStatus,
): Adjustment[] {
  const today = todayISO()
  const tomorrow = toISODate(addDays(fromISODate(today), 1))
  const out: Adjustment[] = []
  const recovery = assessRecovery(logs)
  const shoulderWorse = shoulderAlerts(logs).length > 0

  const upcoming = sessions.filter(
    (s) => s.status === 'planned' && s.type !== 'rest' && (s.date === today || s.date === tomorrow),
  )

  for (const s of upcoming) {
    const label = `${SESSION_TYPES[s.type].label} del ${s.date === today ? 'hoy' : 'mañana'}`
    if (recovery.level === 'red' && s.intensity !== 'low') {
      out.push({
        id: `recover-${s.id}`,
        kind: 'recover',
        sessionId: s.id,
        title: `Bajar a intensidad suave: ${label}`,
        detail: `Semáforo rojo (${recovery.reasons.slice(0, 2).join(', ')}). Se propone intensidad baja y −40 % de duración.`,
        patch: {
          intensity: 'low',
          durationMin: Math.max(20, Math.round((s.durationMin * 0.6) / 5) * 5),
          notes: appendNote(s.notes, 'Adaptada por fatiga elevada.'),
        },
      })
    } else if (recovery.level === 'yellow' && s.intensity === 'high') {
      out.push({
        id: `reduce-${s.id}`,
        kind: 'reduce',
        sessionId: s.id,
        title: `Reducir intensidad: ${label}`,
        detail: 'Fatiga moderada: se propone bajar un nivel de intensidad.',
        patch: { intensity: STEP_DOWN[s.intensity], notes: appendNote(s.notes, 'Intensidad reducida por fatiga moderada.') },
      })
    }

    const needsSparring = s.requiresClearance === 'intense_sparring' && !shoulder.intenseSparringAuthorized
    const needsLoads = s.requiresClearance === 'upper_body_loads' && !shoulder.loadsAuthorized
    if (needsSparring || needsLoads || (shoulderWorse && s.type === 'gym' && s.requiresClearance)) {
      out.push({
        id: `clearance-${s.id}`,
        kind: 'clearance',
        sessionId: s.id,
        title: `Adaptar al estado del hombro: ${label}`,
        detail: needsSparring
          ? 'Sin autorización para sparring intenso: rounds técnicos a intensidad controlada.'
          : 'Sin autorización para cargas de tren superior: sustituir por tren inferior, core y agarre.',
        patch: needsSparring
          ? {
              intensity: 'moderate',
              requiresClearance: null,
              objective: 'Rounds técnicos (adaptada al hombro)',
              activities: ['Calentamiento', 'Rounds técnicos a intensidad controlada', 'Vuelta a la calma'],
            }
          : {
              requiresClearance: null,
              objective: 'Fuerza adaptada (sin tren superior)',
              activities: ['Prensa', 'Curl femoral', 'Gemelos', 'Core', 'Agarre'],
              gym: null,
            },
      })
    }
  }

  // Missed sessions in the last 7 days still marked as planned
  const weekAgo = toISODate(addDays(fromISODate(today), -7))
  for (const s of sessions) {
    if (s.status === 'planned' && s.type !== 'rest' && s.date < today && s.date >= weekAgo) {
      out.push({
        id: `missed-${s.id}`,
        kind: 'missed',
        sessionId: s.id,
        title: `Sesión pasada sin registrar: ${SESSION_TYPES[s.type].label} (${s.date})`,
        detail: 'Márcala como no realizada para mantener tus estadísticas fieles, o regístrala si la hiciste.',
        patch: { status: 'skipped' },
      })
    }
  }
  return out
}

function appendNote(notes: string, add: string) {
  return notes ? `${notes}\n${add}` : add
}
