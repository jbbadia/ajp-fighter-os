import type { TrainingSession } from '@/types/domain'
import { INTENSITY_LABEL, SESSION_TYPES, STATUS_LABEL } from '@/domain/sessionMeta'
import type { WeekStats } from '@/domain/analytics'

type Cell = string | number | null | undefined | boolean

/** RFC 4180 CSV with `;` separator and BOM so Excel (es-ES) opens it correctly. */
export function toCSV(header: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'number' ? v.toLocaleString('es-ES', { useGrouping: false, maximumFractionDigits: 2 }) : String(v)
    // Neutralise spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) && typeof v !== 'number' ? `'${s}` : s
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sessionsCSV(sessions: TrainingSession[]): string {
  const sorted = [...sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  return toCSV(
    ['Fecha', 'Hora', 'Tipo', 'Estado', 'No planificada', 'Duración plan (min)', 'Duración real (min)', 'Intensidad', 'RPE', 'Carga (UA)', 'Objetivo', 'Actividades', 'Rounds BJJ', 'Ejercicios gym', 'FC media', 'Distancia (km)', 'Observaciones'],
    sorted.map((s) => [
      s.date,
      s.time,
      SESSION_TYPES[s.type].label,
      STATUS_LABEL[s.status],
      s.unplanned ? 'Sí' : 'No',
      s.durationMin,
      s.result?.durationMin,
      INTENSITY_LABEL[s.intensity],
      s.result?.rpe,
      s.result ? s.result.durationMin * s.result.rpe : null,
      s.objective,
      s.activities.join(' | '),
      s.bjj?.rounds,
      s.gym?.exercises.map((e) => `${e.name} ${e.sets.map((x) => `${x.reps}x${x.weightKg}`).join(',')}`).join(' | '),
      s.cardio?.avgHr,
      s.cardio?.distanceKm,
      [s.notes, s.result?.notes].filter(Boolean).join(' | '),
    ]),
  )
}

export function weekStatsCSV(stats: WeekStats[]): string {
  return toCSV(
    ['Semana (lunes)', 'Planificadas', 'Completadas', 'Cumplimiento %', 'Min BJJ', 'Min Gi', 'Min No-Gi', 'Min gimnasio', 'Min cardio', 'Carga (UA)', 'RPE medio', 'Volumen gym (kg)', 'Fatiga media', 'Estado general medio', 'Sueño medio (h)', 'Peso medio (kg)', 'Check-ins', 'Objetivos', 'Objetivos cumplidos'],
    stats.map((w) => [w.week, w.planned, w.completed, w.compliance, w.bjjMin, w.giMin, w.nogiMin, w.gymMin, w.cardioMin, w.load, w.avgRpe, w.gymVolumeKg, w.avgFatigue, w.avgWellbeing, w.avgSleepH, w.avgWeightKg, w.checkins, w.goalsTotal, w.goalsDone]),
  )
}
