import type { WeightUnit } from '@/types/domain'

const KG_PER_LB = 0.45359237

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, withUnit = true): string {
  if (kg === null || kg === undefined) return '—'
  const value = kgToUnit(kg, unit).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return withUnit ? `${value} ${unit}` : value
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatHours(min: number): string {
  return (min / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })
}
