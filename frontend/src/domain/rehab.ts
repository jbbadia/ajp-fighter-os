import type { ISODate, RehabLog, RehabSettings, RehabVariant } from '@/types/domain'

/**
 * Derby Shoulder Instability Rehabilitation Programme (M. Bateman, 2013), as prescribed by the physio.
 * One exercise from each section at a time, in order; when the target is achieved, move to the next one.
 * Section 1: max reps until fatigue or the target. Section 2: 5 repetitions of up to the target time.
 * The document indicates two sessions per day.
 */
export interface RehabExercise {
  name: string
  original: string
  target: number
  how: string
}

export const DERBY_S1: RehabExercise[] = [
  { name: 'Soltar y atrapar peso de 1 kg a 90° de escapción', original: 'Drop & catch 1kg weight at 90° scaption', target: 100, how: 'De pie, brazo elevado a 90° en el plano de la escápula. Suelta la mancuerna de 1 kg y atrápala rápido antes de que caiga.' },
  { name: 'Soltar y atrapar 1 kg a 90° de escapción a una pierna', original: 'Drop & catch 1kg at 90° scaption on 1 leg', target: 100, how: 'Igual que el anterior, apoyado sobre la pierna contraria al hombro que trabajas.' },
  { name: 'Soltar y atrapar 1 kg a 90° de escapción con los ojos cerrados', original: 'Drop & catch 1kg at 90° scaption, eyes closed', target: 100, how: 'Igual que el primero, con los ojos cerrados.' },
  { name: 'Soltar y atrapar 1 kg en AER / AIR', original: 'Drop & catch 1kg weight in AER/AIR', target: 100, how: 'AER (inestabilidad anterior): tumbado boca arriba, brazo abducido en rotación externa. AIR (inestabilidad posterior): tumbado boca abajo con el brazo colgando, o de pie con el brazo horizontal.' },
  { name: 'Flexión con caída de pie contra la pared', original: 'Falling press up in standing', target: 50, how: 'Déjate caer contra la pared, amortigua con las dos manos y empuja rápido para volver a la posición de pie.' },
  { name: 'Flexión con caída a la altura de la cintura', original: 'Falling press up to waist level', target: 50, how: 'Igual, pero cayendo sobre una superficie a la altura de la cintura (encimera o camilla).' },
  { name: 'Flexión pliométrica con palmada', original: 'Plyometric push up with hand clap', target: 20, how: 'Flexión explosiva en el suelo dando una palmada en el aire.' },
  { name: 'Caída en el marco de la puerta', original: 'Doorway fall', target: 20, how: 'A un paso de una puerta, déjate caer a través de ella, frena tu peso con las dos manos en el marco y empuja explosivamente de vuelta.' },
]

export const DERBY_S2: RehabExercise[] = [
  { name: 'Rodar balón con una mano en la pared', original: 'Single handed ball roll on wall', target: 60, how: 'De pie, apoyado con una mano sobre un balón contra la pared, ruédalo arriba y abajo despacio y lo más suave posible.' },
  { name: 'Cruces con una mano de rodillas', original: 'Single handed kneeling crosses', target: 60, how: 'De rodillas, desplaza el peso sobre el brazo afectado dibujando una cruz (adelante, atrás, izquierda, derecha).' },
  { name: 'Rodar balón con una mano de rodillas', original: 'Kneeling single handed ball roll', target: 60, how: 'De rodillas, con tu peso sobre un balón, ruédalo despacio y suave.' },
  { name: 'Cruces con una mano en posición de flexión', original: 'Single handed crosses in push up position', target: 60, how: 'En posición de flexión a una mano, desplaza el peso sobre el brazo afectado dibujando una cruz.' },
  { name: 'Rodar balón con dos manos en posición de flexión', original: 'Double handed ball roll in push up position', target: 60, how: 'En posición de flexión con las dos manos sobre un balón, ruédalo arriba y abajo despacio durante 60 s.' },
  { name: 'Rodar dos balones en posición de flexión', original: 'Double ball roll in push up positions', target: 60, how: 'En posición de flexión con una mano en cada balón: uno sube mientras el otro baja, y al revés.' },
]

export const S2_HOLDS = 5
export const POSTERIOR_NOTE =
  'Con inestabilidad posterior importante, los ejercicios a una mano se hacen con el hombro en abducción en lugar de en flexión.'

export const DEFAULT_REHAB: RehabSettings = { s1: 0, s2: 0, variant: null, sessionsPerDay: 2 }

export function s1Name(index: number, variant: RehabVariant | null): string {
  const ex = DERBY_S1[index]
  if (index !== 3 || !variant) return ex.name
  return variant === 'anterior' ? 'Soltar y atrapar 1 kg en AER (rotación externa)' : 'Soltar y atrapar 1 kg en AIR (rotación interna)'
}

/** Target reached: section 1 → reps ≥ target; section 2 → each of the 5 repetitions lasts the target time. */
export function s1Achieved(log: Pick<RehabLog, 's1'>): boolean {
  return !!log.s1 && log.s1.reps >= DERBY_S1[log.s1.index].target
}

export function s2Achieved(log: Pick<RehabLog, 's2'>): boolean {
  return !!log.s2 && log.s2.holds.length >= S2_HOLDS && log.s2.holds.every((h) => h.seconds >= DERBY_S2[log.s2!.index].target)
}

export const sessionsOn = (logs: RehabLog[], date: ISODate) => logs.filter((l) => l.date === date).length

const prevDay = (iso: ISODate) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Consecutive days with at least one session, counting back from today (or yesterday if today is still pending). */
export function rehabStreak(logs: RehabLog[], today: ISODate): number {
  const days = new Set(logs.map((l) => l.date))
  let d = days.has(today) ? today : prevDay(today)
  let n = 0
  while (days.has(d)) {
    n++
    d = prevDay(d)
  }
  return n
}

/** Best result so far with an exercise of each section. */
export function bestS1(logs: RehabLog[], index: number): number | null {
  const reps = logs.filter((l) => l.s1?.index === index).map((l) => l.s1!.reps)
  return reps.length ? Math.max(...reps) : null
}

export function bestS2(logs: RehabLog[], index: number): number | null {
  const secs = logs.filter((l) => l.s2?.index === index).flatMap((l) => l.s2!.holds.map((h) => h.seconds))
  return secs.length ? Math.max(...secs) : null
}
