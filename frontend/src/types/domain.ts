/**
 * Domain model for AJP Fighter OS.
 * These types mirror the future backend DTOs (Phase 5, Spring Boot + MongoDB).
 * Weights are always stored in kg; units are a display concern.
 */

export type ISODate = string // yyyy-MM-dd
export type ISODateTime = string // full ISO timestamp

export interface Entity {
  id: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/* ───────────────────────── Profile ───────────────────────── */

export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export type Modality = 'gi' | 'nogi'
export type WeightGoal = 'maintain' | 'lose' | 'gain'
export type CardioLevel = 'low' | 'medium' | 'high'
export type WeightUnit = 'kg' | 'lb'
export type Theme = 'dark' | 'light'

/** Medical clearance status of the shoulder. Never assumed: defaults to `pending`. */
export type ShoulderClearance = 'pending' | 'limited' | 'full'

export interface ShoulderStatus {
  clearance: ShoulderClearance
  /** Authorised by a health professional to load the upper body. */
  loadsAuthorized: boolean
  /** Authorised by a health professional for intense sparring. */
  intenseSparringAuthorized: boolean
  lastReviewDate: ISODate | null
  notes: string
}

export interface CompetitionInfo {
  name: string
  date: ISODate
  /** The exact day is pending confirmation; the date is an estimate until true. */
  dateConfirmed: boolean
  /** Left empty on purpose: must be set from the official AJP rules. */
  weightCategory: string
  modalities: Modality[]
}

export interface AthleteProfile extends Entity {
  name: string
  sport: string
  belt: Belt
  /** Reference weight entered in the profile. Daily logs take precedence when present. */
  currentWeightKg: number
  targetWeightKg: number
  weightGoal: WeightGoal
  modalities: Modality[]
  bjjDaysPerWeek: number
  gymDaysPerWeek: number
  cardioLevel: CardioLevel
  mainGoal: string
  secondaryGoals: string[]
  competition: CompetitionInfo
  /** Start of the preparation cycle, used for the cycle progress indicator. */
  prepStartDate: ISODate
  shoulder: ShoulderStatus
  settings: {
    weightUnit: WeightUnit
    theme: Theme
    notifications: boolean
  }
  nutritionTargets: {
    calories: number | null
    proteinG: number | null
    carbsG: number | null
    fatG: number | null
    waterL: number | null
  }
  /** Version of the weekly template the planned sessions were generated with. */
  planVersion?: number
  /** Shoulder rehab prescribed by the physio (Derby programme): current exercise of each section. */
  rehab?: RehabSettings
  /** Competition preparation phases, configurable. */
  phases: PrepPhase[]
  checklist: ChecklistItem[]
  /** Configured from the official AJP rules; nothing is assumed. */
  rules: {
    matchDurationMin: number | null
    weightLimitKg: number | null
    weighInNotes: string
    sourceUrl: string
  }
}

export interface PrepPhase {
  id: string
  name: string
  start: ISODate
  end: ISODate
  focus: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/* ───────────────────────── Training ───────────────────────── */

export type SessionType =
  | 'bjj_gi'
  | 'bjj_nogi'
  | 'gym'
  | 'cardio_z2'
  | 'hiit'
  | 'mobility'
  | 'recovery'
  | 'rest'

export type Intensity = 'low' | 'moderate' | 'high'
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped'
/** Why a session was not done. */
export type SkipReason = 'cant_attend' | 'class_cancelled' | 'injury' | 'other'

/** What a planned session needs authorised before it can be done as written. */
export type ClearanceRequirement = 'upper_body_loads' | 'intense_sparring'

export interface SessionResult {
  durationMin: number
  /** Session RPE, 1-10 (Borg CR-10). */
  rpe: number
  notes: string
  completedAt: ISODateTime
}

/* BJJ log */
export type RoundResult = 'win' | 'loss' | 'draw'

export interface SparringRound {
  id: string
  durationMin: number
  result: RoundResult | null
  startPosition: string
  endPosition: string
  submissionsAttempted: number
  submissionsReceived: number
  guardPasses: number
  sweeps: number
  takedowns: number
  mistakes: string
  positives: string
}

export interface BjjLog {
  modality: Modality
  rounds: number
  roundDurationMin: number
  partners: number
  technicalQuality: number | null // 1-10
  finalFatigue: number | null // 1-10
  sparring: SparringRound[]
}

/* Gym log */
export interface SetLog {
  reps: number
  weightKg: number
  rir: number | null
}

export interface ExerciseLog {
  id: string
  exerciseId: string
  name: string
  muscleGroup: string
  restSec: number | null
  notes: string
  sets: SetLog[]
}

export interface GymLog {
  routineId: string | null
  exercises: ExerciseLog[]
}

/* Cardio log */
export type CardioKind = 'z2' | 'hiit' | 'bjj_specific'

export interface CardioLog {
  kind: CardioKind
  avgHr: number | null
  maxHr: number | null
  distanceKm: number | null
  speedKmh: number | null
  machine: string
  /** Optional minutes per HR zone Z1..Z5, only when the device provides them. */
  zoneMinutes: [number, number, number, number, number] | null
  intervals: number | null
  workSec: number | null
  restSec: number | null
  rounds: number | null
  roundDurationMin: number | null
  recoveryFeeling: number | null // 1-10
  muscleFatigue: number | null // 1-10
  results: string
}

export interface TrainingSession extends Entity {
  date: ISODate
  time: string // HH:mm
  durationMin: number
  type: SessionType
  intensity: Intensity
  objective: string
  description: string
  activities: string[]
  status: SessionStatus
  notes: string
  /** Logged without being in the plan. */
  unplanned: boolean
  requiresClearance: ClearanceRequirement | null
  startedAt: ISODateTime | null
  result: SessionResult | null
  skipReason?: SkipReason | null
  bjj?: BjjLog | null
  gym?: GymLog | null
  cardio?: CardioLog | null
}

/* ───────────────────────── Gym catalogue ───────────────────────── */

export interface Exercise extends Entity {
  name: string
  muscleGroup: string
  /** Loads the shoulder: only usable with medical clearance for upper-body loads. */
  upperBody: boolean
  notes: string
}

export interface RoutineItem {
  exerciseId: string
  sets: number
  reps: number
  weightKg: number | null
  rir: number | null
  restSec: number | null
  notes: string
}

export interface Routine extends Entity {
  name: string
  description: string
  items: RoutineItem[]
}

/* ───────────────────────── Technique library ───────────────────────── */

export type TechniqueCategory =
  | 'takedowns'
  | 'guard'
  | 'passes'
  | 'sweeps'
  | 'side_control'
  | 'mount'
  | 'back'
  | 'submissions'
  | 'escapes'
  | 'defense'
export type TechniqueStatus = 'to_learn' | 'developing' | 'mastered'

export interface Technique extends Entity {
  name: string
  category: TechniqueCategory
  status: TechniqueStatus
  /** Main competition technique (A-game). */
  competitionMain: boolean
  modality: Modality | 'both'
  notes: string
  videoUrls: string[]
}

/* ───────────────────────── Nutrition ───────────────────────── */

export interface NutritionLog extends Entity {
  date: ISODate
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  waterL: number | null
  notes: string
}

export interface Supplement extends Entity {
  name: string
  dose: number
  unit: string
  /** Planned times of day (HH:mm). */
  times: string[]
  notes: string
  active: boolean
}

export interface SupplementIntake extends Entity {
  supplementId: string
  date: ISODate
  time: string
  dose: number
}

/* ───────────────────────── Competition ───────────────────────── */

export interface WeeklyGoal extends Entity {
  week: ISODate // Monday
  text: string
  /** When set, progress is computed from real records. */
  metric: 'sessions' | 'bjj_hours' | 'gym_sessions' | 'cardio_minutes' | 'checkins' | null
  target: number | null
  done: boolean
}

export interface SimulationRound {
  durationMin: number
  restMin: number
  result: RoundResult | null
  rpe: number | null
  fatigue: number | null
  notes: string
}

export interface Simulation extends Entity {
  date: ISODate
  modality: Modality
  rounds: SimulationRound[]
  notes: string
}

/* ───────────────────────── Daily health log ───────────────────────── */

export type ShoulderMobility = 'normal' | 'limited' | 'very_limited'

export interface DailyLog extends Entity {
  date: ISODate
  weightKg: number | null
  sleepHours: number | null
  /** 1-10 scales: higher = better for sleepQuality / wellbeing; higher = worse for the rest. */
  sleepQuality: number | null
  fatigue: number | null
  stress: number | null
  soreness: number | null
  wellbeing: number | null
  restingHr: number | null
  shoulderPain: number | null // 0-10
  shoulderMobility: ShoulderMobility | null
  /** Went out partying that day and how many drinks (cubatas). */
  nightOut?: boolean | null
  drinks?: number | null
  notes: string
}

/* ───────────────────────── Shoulder rehab (physio) ───────────────────────── */

export type RehabVariant = 'anterior' | 'posterior'

export interface RehabSettings {
  /** Index of the current exercise in section 1 / section 2 of the programme. */
  s1: number
  s2: number
  /** Instability type as told by the physio (changes exercise 4 of section 1). */
  variant: RehabVariant | null
  sessionsPerDay: number
}

export interface RehabLog extends Entity {
  date: ISODate
  program: 'derby'
  s1: { index: number; reps: number } | null
  s2: { index: number; holds: { seconds: number }[] } | null
  notes: string
}
