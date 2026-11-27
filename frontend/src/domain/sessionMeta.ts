import {
  Activity,
  BedDouble,
  Dumbbell,
  Flame,
  HeartPulse,
  Shirt,
  StretchHorizontal,
  Swords,
  type LucideIcon,
} from 'lucide-react'
import type {
  Belt,
  CardioKind,
  Intensity,
  Modality,
  RoundResult,
  SessionStatus,
  SkipReason,
  SessionType,
  TechniqueCategory,
  TechniqueStatus,
} from '@/types/domain'

export type Discipline = 'bjj' | 'gym' | 'cardio' | 'recovery' | 'rest'

export const SESSION_TYPES: Record<
  SessionType,
  { label: string; short: string; icon: LucideIcon; discipline: Discipline }
> = {
  bjj_gi: { label: 'BJJ Gi', short: 'Gi', icon: Shirt, discipline: 'bjj' },
  bjj_nogi: { label: 'BJJ No-Gi', short: 'No-Gi', icon: Swords, discipline: 'bjj' },
  gym: { label: 'Gimnasio', short: 'Gym', icon: Dumbbell, discipline: 'gym' },
  cardio_z2: { label: 'Cardio Zona 2', short: 'Z2', icon: HeartPulse, discipline: 'cardio' },
  hiit: { label: 'HIIT', short: 'HIIT', icon: Flame, discipline: 'cardio' },
  mobility: { label: 'Movilidad', short: 'Mov.', icon: StretchHorizontal, discipline: 'recovery' },
  recovery: { label: 'Recuperación', short: 'Recup.', icon: Activity, discipline: 'recovery' },
  rest: { label: 'Descanso', short: 'Desc.', icon: BedDouble, discipline: 'rest' },
}

export const SESSION_TYPE_OPTIONS = Object.entries(SESSION_TYPES).map(([value, m]) => ({
  value: value as SessionType,
  label: m.label,
}))

export const INTENSITY_LABEL: Record<Intensity, string> = {
  low: 'Baja',
  moderate: 'Moderada',
  high: 'Alta',
}

export const SKIP_REASONS: { value: SkipReason; label: string; short: string }[] = [
  { value: 'cant_attend', label: 'No puedo ir', short: 'No pude ir' },
  { value: 'class_cancelled', label: 'Clase cancelada', short: 'Cancelada' },
  { value: 'injury', label: 'Molestias / lesión', short: 'Molestias' },
  { value: 'other', label: 'Otro motivo', short: 'Otro motivo' },
]

export const skipLabel = (r: SkipReason | null | undefined) => SKIP_REASONS.find((x) => x.value === r)?.short ?? null

export const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: 'Planificada',
  in_progress: 'En curso',
  completed: 'Completada',
  skipped: 'No realizada',
}

export const BELT_LABEL: Record<Belt, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Morado',
  brown: 'Marrón',
  black: 'Negro',
}

export const TECHNIQUE_CATEGORY_LABEL: Record<TechniqueCategory, string> = {
  takedowns: 'Derribos',
  guard: 'Guardia',
  passes: 'Pases',
  sweeps: 'Barridos',
  side_control: 'Control lateral',
  mount: 'Montada',
  back: 'Espalda',
  submissions: 'Sumisiones',
  escapes: 'Escapes',
  defense: 'Defensa',
}

export const TECHNIQUE_STATUS_LABEL: Record<TechniqueStatus, string> = {
  to_learn: 'Por aprender',
  developing: 'En desarrollo',
  mastered: 'Dominada',
}

export const CARDIO_KIND_LABEL: Record<CardioKind, string> = {
  z2: 'Zona 2',
  hiit: 'HIIT',
  bjj_specific: 'Cardio específico BJJ',
}

export const RESULT_LABEL: Record<RoundResult, string> = { win: 'Victoria', loss: 'Derrota', draw: 'Empate' }

export const MODALITY_LABEL: Record<Modality, string> = { gi: 'Gi', nogi: 'No-Gi' }

/** Tailwind classes per discipline (identity, not status). */
export const DISCIPLINE_STYLE: Record<Discipline, string> = {
  bjj: 'bg-primary/15 text-primary',
  gym: 'bg-sky-500/15 text-sky-500 dark:text-sky-400',
  cardio: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  recovery: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  rest: 'bg-muted text-muted-foreground',
}

/** Detailed logs exist for BJJ, gym and cardio sessions. */
export function hasDetailedLog(type: SessionType) {
  return ['bjj', 'gym', 'cardio'].includes(SESSION_TYPES[type].discipline)
}
