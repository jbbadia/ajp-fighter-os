import { describe, expect, it } from 'vitest'
import type { Exercise, Routine } from '@/types/domain'
import { initialExercises, initialRoutines } from '@/data/seed'
import { generatePlannedSessions } from '@/domain/planTemplate'
import { planForSession } from './workoutPlan'

const exercises = initialExercises().map((e) => ({ ...e, id: e.id!, createdAt: '', updatedAt: '' })) as Exercise[]
const routines = initialRoutines(exercises).map((r) => ({ ...r, id: r.id!, createdAt: '', updatedAt: '' })) as Routine[]
const shoulder = { clearance: 'pending' as const, loadsAuthorized: false, intenseSparringAuthorized: false, lastReviewDate: null, notes: '' }
const week = generatePlannedSessions(shoulder, '2026-11-30', '2026-12-06')

describe('gym workout plan', () => {
  it('Monday loads the lower-body routine in order', () => {
    const monday = week.find((s) => s.date === '2026-11-30' && s.type === 'gym')!
    const p = planForSession(monday, routines, exercises, false)
    expect(p.routineId).toBe('rt-tren-inferior')
    expect(p.items.map((i) => i.exercise.name)).toEqual(['Hack squat', 'Prensa', 'Curl femoral', 'Hip thrust', 'Gemelos', 'Core (plancha / dead bug)'])
    expect(p.items[0].target).toMatchObject({ sets: 4, reps: 8 })
  })
  it('Thursday uses its listed exercises and never upper body without clearance', () => {
    const thursday = week.find((s) => s.date === '2026-12-03' && s.type === 'gym')!
    const p = planForSession(thursday, routines, exercises, false)
    expect(p.items.map((i) => i.exercise.name)).toEqual(['Prensa', 'Curl femoral', 'Gemelos', 'Core (plancha / dead bug)', 'Agarre (gripper / pinza)'])
    expect(p.items.some((i) => i.exercise.upperBody)).toBe(false)
  })
})
