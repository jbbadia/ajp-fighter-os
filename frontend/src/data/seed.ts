import type { AthleteProfile, ChecklistItem, Exercise, ISODate, PrepPhase, Routine } from '@/types/domain'
import { addDays, daysUntil, fromISODate, toISODate, todayISO } from '@/lib/dates'
import { uid } from '@/lib/utils'
import type { NewEntity } from './store'

export const PROFILE_ID = 'me'

/** Splits the preparation window into the 4 phases (35/30/25/10 %). Fully editable later. */
export function defaultPhases(start: ISODate, end: ISODate): PrepPhase[] {
  const total = Math.max(4, -daysUntil(start, fromISODate(end)))
  const shares = [0.35, 0.3, 0.25, 0.1]
  const names: [string, string][] = [
    ['Construcción de base', 'Base aeróbica, técnica, fuerza general y rehabilitación del hombro según pautas.'],
    ['Desarrollo físico', 'Fuerza, potencia y capacidad de trabajo específica.'],
    ['Preparación específica', 'Simulaciones de combate, rounds a ritmo de competición y plan de juego.'],
    ['Tapering / descarga', 'Reducir volumen manteniendo intensidad. Llegar fresco al torneo.'],
  ]
  let cursor = fromISODate(start)
  return names.map(([name, focus], i) => {
    const len = i === 3 ? 0 : Math.round(total * shares[i])
    const phaseStart = toISODate(cursor)
    const phaseEnd = i === 3 ? end : toISODate(addDays(cursor, len - 1))
    cursor = addDays(cursor, len)
    return { id: uid(), name, start: phaseStart, end: phaseEnd, focus }
  })
}

const DEFAULT_CHECKLIST = [
  'Confirmar la fecha exacta del torneo',
  'Consultar el reglamento oficial AJP de mi división',
  'Definir la categoría de peso',
  'Realizar la inscripción',
  'Valoración médica del hombro y autorización',
  'Kimono reglamentario (Gi)',
  'Rash guard y shorts reglamentarios (No-Gi)',
  'Planificar viaje y alojamiento',
]

export function defaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST.map((text) => ({ id: uid(), text, done: false }))
}

/** Athlete profile supplied by the user. No performance data is invented. */
export function initialProfile(name = 'Deportista'): NewEntity<AthleteProfile> {
  const prepStartDate = todayISO()
  const compDate = '2027-02-01'
  return {
    id: PROFILE_ID,
    name: name.trim().slice(0, 60) || 'Deportista',
    sport: 'Brazilian Jiu-Jitsu',
    belt: 'white',
    currentWeightKg: 77.5,
    targetWeightKg: 77.5,
    weightGoal: 'maintain',
    modalities: ['gi', 'nogi'],
    bjjDaysPerWeek: 6,
    gymDaysPerWeek: 4,
    cardioLevel: 'medium',
    mainGoal: 'Competir en las mejores condiciones posibles',
    secondaryGoals: ['Fuerza', 'Resistencia', 'Explosividad', 'Recuperación', 'Técnica'],
    competition: {
      name: 'AJP 2027',
      date: compDate,
      dateConfirmed: false,
      weightCategory: '',
      modalities: ['gi', 'nogi'],
    },
    prepStartDate,
    shoulder: {
      clearance: 'pending',
      loadsAuthorized: false,
      intenseSparringAuthorized: false,
      lastReviewDate: null,
      notes: 'Lesión de hombro pendiente de valoración y autorización para cargas y sparring intenso.',
    },
    settings: { weightUnit: 'kg', theme: 'dark', notifications: true },
    nutritionTargets: { calories: null, proteinG: null, carbsG: null, fatG: null, waterL: null },
    phases: defaultPhases(prepStartDate, compDate),
    checklist: defaultChecklist(),
    rules: { matchDurationMin: null, weightLimitKg: null, weighInNotes: '', sourceUrl: '' },
  }
}

/** Fills fields added in later versions so older saved profiles keep working. */
export function migrateProfile(p: AthleteProfile): AthleteProfile | null {
  const patch: Partial<AthleteProfile> = {}
  if (p.settings.notifications === undefined) patch.settings = { ...p.settings, notifications: true }
  if (!p.nutritionTargets) patch.nutritionTargets = { calories: null, proteinG: null, carbsG: null, fatG: null, waterL: null }
  if (!p.phases) patch.phases = defaultPhases(p.prepStartDate, p.competition.date)
  if (!p.checklist) patch.checklist = defaultChecklist()
  if (!p.rules) patch.rules = { matchDurationMin: null, weightLimitKg: null, weighInNotes: '', sourceUrl: '' }
  return Object.keys(patch).length ? { ...p, ...patch } : null
}

/* Exercise catalogue: names only, no loads. Upper-body items depend on shoulder clearance. */
const EXERCISES: [string, string, boolean][] = [
  ['Hack squat', 'Cuádriceps', false],
  ['Prensa', 'Cuádriceps', false],
  ['Curl femoral', 'Isquiotibiales', false],
  ['Hip thrust', 'Glúteos', false],
  ['Gemelos', 'Gemelos', false],
  ['Core (plancha / dead bug)', 'Core', false],
  ['Agarre (gripper / pinza)', 'Antebrazo', false],
  ['Remo con apoyo', 'Espalda', true],
  ['Jalón neutro', 'Espalda', true],
]

/** Stable id from a name, so every device seeds the same records and syncing never duplicates them. */
const seedId = (prefix: string, name: string) =>
  `${prefix}-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

export function initialExercises(): NewEntity<Exercise>[] {
  return EXERCISES.map(([name, muscleGroup, upperBody]) => ({ id: seedId('ex', name), name, muscleGroup, upperBody, notes: '' }))
}

export function initialRoutines(exercises: Exercise[]): NewEntity<Routine>[] {
  const byName = (n: string) => exercises.find((e) => e.name === n)!.id
  const item = (name: string, sets: number, reps: number) => ({
    exerciseId: byName(name), sets, reps, weightKg: null, rir: 2, restSec: 120, notes: '',
  })
  return [
    {
      id: seedId('rt', 'Tren inferior'),
      name: 'Tren inferior',
      description: 'Fuerza de piernas y cadena posterior. No carga el hombro.',
      items: [
        item('Hack squat', 4, 8), item('Prensa', 3, 10), item('Curl femoral', 3, 10),
        item('Hip thrust', 3, 10), item('Gemelos', 3, 12), item('Core (plancha / dead bug)', 3, 1),
      ],
    },
    {
      id: seedId('rt', 'Core y agarre'),
      name: 'Core y agarre',
      description: 'Complementario compatible con la restricción de hombro.',
      items: [item('Core (plancha / dead bug)', 3, 1), item('Agarre (gripper / pinza)', 4, 12)],
    },
    {
      id: seedId('rt', 'Tren superior'),
      name: 'Tren superior (requiere autorización)',
      description: 'Solo con autorización médica para cargas de tren superior.',
      items: [item('Remo con apoyo', 3, 10), item('Jalón neutro', 3, 10), item('Core (plancha / dead bug)', 3, 1)],
    },
  ]
}
