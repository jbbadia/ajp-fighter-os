import type {
  ClearanceRequirement,
  Intensity,
  ISODate,
  SessionType,
  ShoulderStatus,
  TrainingSession,
} from '@/types/domain'
import { addDays, fromISODate, toISODate, weekdayIndex } from '@/lib/dates'
import type { NewEntity } from '@/data/store'

export interface TemplateSession {
  type: SessionType
  time: string
  durationMin: number
  intensity: Intensity
  objective: string
  description: string
  activities: string[]
  requiresClearance: ClearanceRequirement | null
}

/**
 * Initial weekly plan (Monday = 0). Times and durations are editable defaults.
 * Upper-body loading is only included when the shoulder has medical clearance.
 */
export function weeklyTemplate(shoulder: ShoulderStatus): TemplateSession[][] {
  const upperCleared = shoulder.loadsAuthorized
  const sparringCleared = shoulder.intenseSparringAuthorized

  const bjj = (
    type: 'bjj_gi' | 'bjj_nogi',
    objective: string,
    activities: string[],
    intensity: Intensity = 'moderate',
    requiresClearance: ClearanceRequirement | null = null,
    opts: { time?: string; description?: string } = {},
  ): TemplateSession => ({
    type,
    // Academy timetable: adult classes Mon-Thu 19:00-20:30, open mat Fri 19:00 and Sat 10:00
    time: opts.time ?? '19:00',
    durationMin: 90,
    intensity,
    objective,
    description: opts.description ?? (type === 'bjj_gi' ? 'Clase de BJJ con kimono.' : 'Clase de BJJ sin kimono.'),
    activities,
    requiresClearance,
  })

  return [
    // Lunes
    [
      {
        type: 'gym',
        time: '20:30',
        durationMin: 60,
        intensity: 'moderate',
        objective: 'Fuerza de tren inferior',
        description: 'Fuerza de piernas y cadena posterior. Sin carga sobre el hombro.',
        activities: ['Hack squat', 'Prensa', 'Curl femoral', 'Hip thrust', 'Gemelos', 'Core'],
        requiresClearance: null,
      },
      bjj('bjj_gi', 'Técnica y drilling Gi', ['Calentamiento', 'Técnica', 'Drilling', 'Sparring técnico']),
    ],
    // Martes
    [
      {
        type: 'cardio_z2',
        time: '17:30',
        durationMin: 45,
        intensity: 'low',
        objective: 'Base aeróbica (Zona 2)',
        description: 'Cardio continuo a intensidad conversacional.',
        activities: ['Bici estática o elíptica', 'Ritmo constante en Zona 2'],
        requiresClearance: null,
      },
      bjj('bjj_nogi', 'Técnica y drilling No-Gi', ['Calentamiento', 'Técnica', 'Drilling', 'Sparring técnico']),
    ],
    // Miércoles
    [
      {
        type: 'mobility',
        time: '17:30',
        durationMin: 30,
        intensity: 'low',
        objective: 'Trabajo complementario',
        description: 'Movilidad de cadera y columna, core y agarre. Ejercicios de hombro solo los pautados por el profesional sanitario.',
        activities: ['Movilidad de cadera', 'Movilidad torácica', 'Core', 'Agarre'],
        requiresClearance: null,
      },
      bjj('bjj_gi', 'Técnica y situaciones específicas Gi', ['Calentamiento', 'Técnica', 'Sparring situacional']),
    ],
    // Jueves
    [
      {
        type: 'gym',
        time: '20:30',
        durationMin: 60,
        intensity: 'moderate',
        objective: 'Fuerza adaptada al estado del hombro',
        description: upperCleared
          ? 'Fuerza general con tren superior autorizado. Respetar las pautas médicas.'
          : 'Tren superior pendiente de autorización médica: solo tren inferior, core y agarre.',
        activities: upperCleared
          ? ['Remo con apoyo', 'Jalón neutro', 'Hip thrust', 'Core', 'Agarre']
          : ['Prensa', 'Curl femoral', 'Gemelos', 'Core', 'Agarre'],
        requiresClearance: upperCleared ? 'upper_body_loads' : null,
      },
      bjj('bjj_nogi', 'Técnica y drilling No-Gi', ['Calentamiento', 'Técnica', 'Drilling', 'Sparring técnico']),
    ],
    // Viernes
    [
      bjj(
        'bjj_gi',
        sparringCleared ? 'Open mat · rounds de intensidad competitiva' : 'Open mat · rounds técnicos (sparring intenso pendiente de autorización)',
        sparringCleared
          ? ['Calentamiento', 'Rounds a intensidad de competición', 'Vuelta a la calma']
          : ['Calentamiento', 'Rounds técnicos a intensidad controlada', 'Vuelta a la calma'],
        sparringCleared ? 'high' : 'moderate',
        sparringCleared ? 'intense_sparring' : null,
        { description: 'Open mat (19:00–20:30).' },
      ),
    ],
    // Sábado
    [
      bjj('bjj_nogi', 'Open mat · técnica y rounds No-Gi', ['Calentamiento', 'Técnica', 'Sparring técnico'], 'moderate', null, {
        time: '10:00',
        description: 'Open mat del sábado (10:00–11:30).',
      }),
      {
        type: 'recovery',
        time: '12:00',
        durationMin: 30,
        intensity: 'low',
        objective: 'Recuperación activa',
        description: 'Movimiento suave para favorecer la recuperación.',
        activities: ['Paseo o bici suave', 'Movilidad general', 'Estiramientos'],
        requiresClearance: null,
      },
    ],
    // Domingo
    [
      {
        type: 'rest',
        time: '10:00',
        durationMin: 0,
        intensity: 'low',
        objective: 'Descanso completo',
        description: 'Día libre de entrenamiento.',
        activities: [],
        requiresClearance: null,
      },
    ],
  ]
}

/** Materialise the template as planned sessions for every day in [from, to]. */
export function generatePlannedSessions(
  shoulder: ShoulderStatus,
  from: ISODate,
  to: ISODate,
): NewEntity<TrainingSession>[] {
  const template = weeklyTemplate(shoulder)
  const out: NewEntity<TrainingSession>[] = []
  for (let d = fromISODate(from); toISODate(d) <= to; d = addDays(d, 1)) {
    const date = toISODate(d)
    // Day order follows the clock (gym at 20:30, after the 19:00–20:30 class).
    for (const t of [...template[weekdayIndex(date)]].sort((a, b) => a.time.localeCompare(b.time))) {
      out.push({
        ...t,
        // Same id on every device, so syncing PC and phone never duplicates the plan.
        id: `tpl-${date}-${t.type}-${t.time.replace(':', '')}`,
        date,
        status: 'planned',
        notes: '',
        unplanned: false,
        startedAt: null,
        result: null,
      })
    }
  }
  return out
}
