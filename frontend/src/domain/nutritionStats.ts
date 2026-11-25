import type { DailyLog, NutritionLog } from '@/types/domain'
import { addDays, daysUntil, fmt, fromISODate, lastWeekKeys, toISODate, weekKey } from '@/lib/dates'
import { average, isPresent, round } from '@/lib/utils'
import { sortedLogs } from './recovery'

/** Daily fasting weight with the trailing 7-day mean (computed only when ≥ 3 weighings in the window). */
export function weightWithAverage(logs: DailyLog[], days: number) {
  const withWeight = sortedLogs(logs).filter((l) => isPresent(l.weightKg))
  return withWeight
    .filter((l) => -daysUntil(l.date) < days && daysUntil(l.date) <= 0)
    .map((l) => {
      const from = toISODate(addDays(fromISODate(l.date), -6))
      const window = withWeight.filter((x) => x.date >= from && x.date <= l.date).map((x) => x.weightKg!)
      return {
        date: l.date,
        label: fmt(l.date, 'd MMM'),
        value: l.weightKg!,
        value2: window.length >= 3 ? round(average(window)!, 2) : null,
      }
    })
}

export interface WeekNutrition {
  week: string
  label: string
  weight: number | null
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  waterL: number | null
  days: number
}

/** Weekly means over the days that have data (days without a record are not counted as zero). */
export function weeklyNutrition(nutrition: NutritionLog[], logs: DailyLog[], weeks = 4): WeekNutrition[] {
  return lastWeekKeys(weeks)
    .reverse()
    .map((wk) => {
      const n = nutrition.filter((x) => weekKey(x.date) === wk)
      const w = logs.filter((x) => weekKey(x.date) === wk && isPresent(x.weightKg)).map((x) => x.weightKg!)
      const avg = (pick: (x: NutritionLog) => number | null) => {
        const a = average(n.map(pick).filter(isPresent))
        return a === null ? null : round(a, 1)
      }
      return {
        week: wk,
        label: `Semana del ${fmt(wk, 'd MMM')}`,
        weight: w.length ? round(average(w)!, 2) : null,
        calories: avg((x) => x.calories),
        proteinG: avg((x) => x.proteinG),
        carbsG: avg((x) => x.carbsG),
        fatG: avg((x) => x.fatG),
        waterL: avg((x) => x.waterL),
        days: n.length,
      }
    })
}
