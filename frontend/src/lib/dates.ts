import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { ISODate } from '@/types/domain'

const WEEK = { weekStartsOn: 1 as const }

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function fromISODate(date: ISODate): Date {
  return parseISO(date)
}

export function daysUntil(date: ISODate, from: Date = new Date()): number {
  return differenceInCalendarDays(fromISODate(date), from)
}

export function weekRange(ref: Date = new Date()) {
  return { start: startOfWeek(ref, WEEK), end: endOfWeek(ref, WEEK) }
}

export function isInWeek(date: ISODate, ref: Date = new Date()): boolean {
  return isWithinInterval(fromISODate(date), weekRange(ref))
}

/** Monday-start ISO date of the week containing `date`. */
export function weekKey(date: ISODate | Date): ISODate {
  const d = typeof date === 'string' ? fromISODate(date) : date
  return toISODate(startOfWeek(d, WEEK))
}

/** The last `count` week keys, oldest first, ending with the current week. */
export function lastWeekKeys(count: number, ref: Date = new Date()): ISODate[] {
  const current = startOfWeek(ref, WEEK)
  return Array.from({ length: count }, (_, i) => toISODate(addDays(current, -7 * (count - 1 - i))))
}

export function fmt(date: ISODate | Date, pattern: string): string {
  const d = typeof date === 'string' ? fromISODate(date) : date
  return format(d, pattern, { locale: es })
}

export function weekdayIndex(date: ISODate): number {
  // 0 = Monday … 6 = Sunday
  return (fromISODate(date).getDay() + 6) % 7
}

export { addDays }
