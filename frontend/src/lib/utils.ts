import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export function average(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
