import type { ClearanceRequirement, DailyLog, ShoulderStatus } from '@/types/domain'
import { daysUntil } from '@/lib/dates'

export type RecoveryLevel = 'green' | 'yellow' | 'red' | 'unknown'

export interface RecoveryAssessment {
  level: RecoveryLevel
  reasons: string[]
  log: DailyLog | null
}

/** A log older than this is not used to assess today's recovery. */
const MAX_LOG_AGE_DAYS = 1

/**
 * Traffic-light rules on the athlete's own subjective scores.
 * This is a training-load aid, not a medical assessment.
 */
export function assessRecovery(logs: DailyLog[]): RecoveryAssessment {
  const latest = latestLog(logs)
  if (!latest || -daysUntil(latest.date) > MAX_LOG_AGE_DAYS) {
    return { level: 'unknown', reasons: ['Sin check-in reciente'], log: latest }
  }
  const red: string[] = []
  const yellow: string[] = []
  const check = (value: number | null, redIf: (v: number) => boolean, yellowIf: (v: number) => boolean, label: string) => {
    if (value === null) return
    if (redIf(value)) red.push(label)
    else if (yellowIf(value)) yellow.push(label)
  }

  check(latest.fatigue, (v) => v >= 8, (v) => v >= 6, `Fatiga ${latest.fatigue}/10`)
  check(latest.soreness, (v) => v >= 8, (v) => v >= 6, `Dolor muscular ${latest.soreness}/10`)
  check(latest.sleepQuality, (v) => v <= 3, (v) => v <= 5, `Calidad de sueño ${latest.sleepQuality}/10`)
  check(latest.sleepHours, (v) => v < 5, (v) => v < 6.5, `${latest.sleepHours} h de sueño`)
  check(latest.wellbeing, (v) => v <= 3, (v) => v <= 5, `Estado general ${latest.wellbeing}/10`)
  check(latest.stress, (v) => v >= 9, (v) => v >= 7, `Estrés ${latest.stress}/10`)
  check(latest.shoulderPain, (v) => v >= 6, (v) => v >= 3, `Dolor de hombro ${latest.shoulderPain}/10`)
  if (latest.shoulderMobility === 'very_limited') red.push('Movilidad del hombro muy limitada')
  else if (latest.shoulderMobility === 'limited') yellow.push('Movilidad del hombro limitada')

  if (red.length) return { level: 'red', reasons: [...red, ...yellow], log: latest }
  if (yellow.length) return { level: 'yellow', reasons: yellow, log: latest }
  return { level: 'green', reasons: ['Indicadores dentro de rango'], log: latest }
}

export const RECOVERY_COPY: Record<RecoveryLevel, { label: string; advice: string }> = {
  green: {
    label: 'Recuperación adecuada',
    advice: 'Puedes seguir la planificación prevista.',
  },
  yellow: {
    label: 'Fatiga moderada',
    advice: 'Considera reducir volumen o intensidad hoy y priorizar el descanso.',
  },
  red: {
    label: 'Fatiga elevada',
    advice:
      'Se recomienda reducir la carga de forma notable. Si hay dolor o síntomas preocupantes, consulta con un profesional sanitario.',
  },
  unknown: {
    label: 'Sin datos de hoy',
    advice: 'Registra tu check-in diario para valorar tu recuperación.',
  },
}

export interface HealthAlert {
  id: string
  severity: 'warning' | 'critical'
  title: string
  detail: string
}

const MOBILITY_RANK = { normal: 0, limited: 1, very_limited: 2 } as const

/** Alerts for increasing shoulder pain or loss of mobility across recent logs. */
export function shoulderAlerts(logs: DailyLog[]): HealthAlert[] {
  const recent = sortedLogs(logs)
    .filter((l) => l.shoulderPain !== null || l.shoulderMobility !== null)
    .slice(-3)
  const alerts: HealthAlert[] = []
  if (recent.length < 2) return alerts

  const pains = recent.map((l) => l.shoulderPain).filter((v): v is number => v !== null)
  if (pains.length >= 2) {
    const first = pains[0]
    const last = pains[pains.length - 1]
    const rising = pains.every((v, i) => i === 0 || v >= pains[i - 1])
    if (rising && last - first >= 2) {
      alerts.push({
        id: 'shoulder-pain-rising',
        severity: last >= 6 ? 'critical' : 'warning',
        title: 'Dolor de hombro en aumento',
        detail: `Ha pasado de ${first}/10 a ${last}/10 en tus últimos registros. Reduce la carga sobre el hombro y coméntalo con tu profesional sanitario.`,
      })
    }
  }

  const mobs = recent.map((l) => l.shoulderMobility).filter((v) => v !== null)
  if (mobs.length >= 2 && MOBILITY_RANK[mobs[mobs.length - 1]] > MOBILITY_RANK[mobs[0]]) {
    alerts.push({
      id: 'shoulder-mobility-loss',
      severity: 'critical',
      title: 'Pérdida de movilidad del hombro',
      detail: 'Tu registro indica menos movilidad que en días anteriores. Evita cargarlo y consulta con un profesional sanitario.',
    })
  }
  return alerts
}

/** Returns a warning when a session needs an authorisation the athlete doesn't have. */
export function clearanceWarning(req: ClearanceRequirement | null, shoulder: ShoulderStatus): string | null {
  if (req === 'upper_body_loads' && !shoulder.loadsAuthorized)
    return 'Incluye carga de tren superior sin autorización médica registrada. Sustituye esos ejercicios.'
  if (req === 'intense_sparring' && !shoulder.intenseSparringAuthorized)
    return 'Sparring intenso sin autorización médica registrada. Mantén una intensidad controlada.'
  return null
}

export function sortedLogs(logs: DailyLog[]): DailyLog[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date))
}

export function latestLog(logs: DailyLog[]): DailyLog | null {
  const s = sortedLogs(logs)
  return s.length ? s[s.length - 1] : null
}
