import type { DailyLog, Supplement, SupplementIntake, TrainingSession } from '@/types/domain'
import { addDays, fromISODate, todayISO, toISODate } from '@/lib/dates'
import { SESSION_TYPES } from './sessionMeta'
import { shoulderAlerts } from './recovery'

export interface PendingItem {
  id: string
  title: string
  detail: string
  to: string
  severity: 'info' | 'warning'
}

/** In-app reminders derived from real data (nothing is stored). */
export function pendingItems(
  sessions: TrainingSession[],
  logs: DailyLog[],
  supplements: Supplement[],
  intakes: SupplementIntake[],
  now = new Date(),
): PendingItem[] {
  const today = todayISO()
  const hhmm = now.toTimeString().slice(0, 5)
  const weekAgo = toISODate(addDays(fromISODate(today), -7))
  const out: PendingItem[] = []

  const todays = sessions.filter((s) => s.date === today && s.type !== 'rest' && (s.status === 'planned' || s.status === 'in_progress'))
  for (const s of todays.sort((a, b) => a.time.localeCompare(b.time))) {
    out.push({
      id: `today-${s.id}`,
      title: `${SESSION_TYPES[s.type].label} a las ${s.time}`,
      detail: s.status === 'in_progress' ? 'Sesión en curso' : s.time < hhmm ? 'Pendiente de registrar' : s.objective,
      to: '/calendario',
      severity: 'info',
    })
  }
  const missed = sessions.filter((s) => s.status === 'planned' && s.type !== 'rest' && s.date < today && s.date >= weekAgo)
  if (missed.length) {
    out.push({ id: 'missed', title: `${missed.length} sesión(es) pasadas sin registrar`, detail: 'Regístralas o márcalas como no realizadas.', to: '/calendario', severity: 'warning' })
  }
  if (!logs.some((l) => l.date === today)) {
    out.push({ id: 'checkin', title: 'Check-in diario pendiente', detail: 'Peso, sueño, fatiga y hombro.', to: '/recuperacion', severity: 'info' })
  }
  for (const a of shoulderAlerts(logs)) out.push({ id: a.id, title: a.title, detail: a.detail, to: '/recuperacion', severity: 'warning' })

  const due = supplements
    .filter((s) => s.active)
    .flatMap((s) => s.times.filter((t) => t <= hhmm && !intakes.some((i) => i.supplementId === s.id && i.date === today && i.time === t)).map((t) => `${s.name} (${t})`))
  if (due.length) out.push({ id: 'supps', title: 'Suplementos pendientes', detail: due.join(', '), to: '/nutricion', severity: 'info' })
  return out
}
