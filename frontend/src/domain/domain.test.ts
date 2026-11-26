import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyLog, ShoulderStatus, TrainingSession } from '@/types/domain'
import { assessRecovery, clearanceWarning, shoulderAlerts } from './recovery'
import { cycleProgress, nextSession, weekSummary } from './metrics'
import { estimated1RM, personalRecords, suggestNext } from './gymStats'
import { consistencyStreak, goalProgress, type WeekStats } from './analytics'
import { suggestAdjustments } from './adaptation'
import { generatePlannedSessions } from './planTemplate'
import { toCSV } from '@/lib/export'
import { initialProfile } from '@/data/seed'
import type { AthleteProfile } from '@/types/domain'

const NOW = new Date('2026-11-25T12:00:00') // Wednesday

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const log = (date: string, p: Partial<DailyLog> = {}): DailyLog => ({
  id: date, createdAt: '', updatedAt: '', date,
  weightKg: null, sleepHours: null, sleepQuality: null, fatigue: null, stress: null, soreness: null,
  wellbeing: null, restingHr: null, shoulderPain: null, shoulderMobility: null, notes: '', ...p,
})

const session = (p: Partial<TrainingSession>): TrainingSession => ({
  id: Math.random().toString(36).slice(2), createdAt: '', updatedAt: '',
  date: '2026-11-25', time: '19:30', durationMin: 60, type: 'bjj_gi', intensity: 'moderate',
  objective: '', description: '', activities: [], status: 'planned', notes: '', unplanned: false,
  requiresClearance: null, startedAt: null, result: null, ...p,
})

const noClearance: ShoulderStatus = { clearance: 'pending', loadsAuthorized: false, intenseSparringAuthorized: false, lastReviewDate: null, notes: '' }

describe('recovery traffic light', () => {
  it('is unknown without a recent check-in', () => {
    expect(assessRecovery([]).level).toBe('unknown')
    expect(assessRecovery([log('2026-11-20', { fatigue: 2 })]).level).toBe('unknown')
  })
  it('is green, yellow or red according to the thresholds', () => {
    expect(assessRecovery([log('2026-11-25', { fatigue: 3, sleepHours: 8 })]).level).toBe('green')
    expect(assessRecovery([log('2026-11-25', { fatigue: 6 })]).level).toBe('yellow')
    expect(assessRecovery([log('2026-11-25', { shoulderPain: 6 })]).level).toBe('red')
    expect(assessRecovery([log('2026-11-25', { shoulderMobility: 'very_limited' })]).level).toBe('red')
  })
  it('accepts yesterday as recent', () => {
    expect(assessRecovery([log('2026-11-24', { sleepHours: 4 })]).level).toBe('red')
  })
})

describe('shoulder alerts', () => {
  it('alerts when pain rises by 2+ points across recent logs', () => {
    const a = shoulderAlerts([log('2026-11-23', { shoulderPain: 2 }), log('2026-11-24', { shoulderPain: 3 }), log('2026-11-25', { shoulderPain: 4 })])
    expect(a.map((x) => x.id)).toContain('shoulder-pain-rising')
  })
  it('does not alert on stable or decreasing pain', () => {
    expect(shoulderAlerts([log('2026-11-24', { shoulderPain: 4 }), log('2026-11-25', { shoulderPain: 3 })])).toHaveLength(0)
  })
  it('alerts on loss of mobility', () => {
    const a = shoulderAlerts([log('2026-11-24', { shoulderMobility: 'normal' }), log('2026-11-25', { shoulderMobility: 'limited' })])
    expect(a[0].id).toBe('shoulder-mobility-loss')
  })
  it('warns when a session needs clearance that is missing', () => {
    expect(clearanceWarning('intense_sparring', noClearance)).toMatch(/autorización/)
    expect(clearanceWarning('intense_sparring', { ...noClearance, intenseSparringAuthorized: true })).toBeNull()
  })
})

describe('initial plan', () => {
  it('never schedules upper-body loads or intense sparring without clearance', () => {
    const week = generatePlannedSessions(noClearance, '2026-11-23', '2026-11-29')
    expect(week.some((s) => s.requiresClearance)).toBe(false)
    expect(week.filter((s) => s.type === 'bjj_gi' || s.type === 'bjj_nogi')).toHaveLength(6)
    expect(week.filter((s) => s.type === 'gym')).toHaveLength(2)
    const thursdayGym = week.find((s) => s.date === '2026-11-26' && s.type === 'gym')!
    expect(thursdayGym.activities).not.toContain('Remo con apoyo')
  })
  it('follows the academy timetable (19:00 classes, Fri 19:00 and Sat 10:00 open mats)', () => {
    const week = generatePlannedSessions(noClearance, '2026-11-23', '2026-11-29')
    const bjj = week.filter((s) => s.type === 'bjj_gi' || s.type === 'bjj_nogi')
    expect(bjj.map((s) => `${s.date} ${s.time}`)).toEqual([
      '2026-11-23 19:00', '2026-11-24 19:00', '2026-11-25 19:00', '2026-11-26 19:00', '2026-11-27 19:00', '2026-11-28 10:00',
    ])
    expect(bjj.every((s) => s.durationMin === 90)).toBe(true)
    expect(bjj[4].objective).toMatch(/Open mat/)
  })
  it('puts the gym after the BJJ class and uses the same ids on every device', () => {
    const week = generatePlannedSessions(noClearance, '2026-11-23', '2026-11-29')
    const monday = week.filter((s) => s.date === '2026-11-23')
    expect(monday.map((s) => `${s.type} ${s.time}`)).toEqual(['bjj_gi 19:00', 'gym 20:30'])
    expect(week.filter((s) => s.type === 'gym').every((s) => s.time === '20:30')).toBe(true)
    const again = generatePlannedSessions(noClearance, '2026-11-23', '2026-11-29')
    expect(again.map((s) => s.id)).toEqual(week.map((s) => s.id))
    expect(new Set(week.map((s) => s.id)).size).toBe(week.length)
  })
  it('includes them once authorised', () => {
    const week = generatePlannedSessions({ ...noClearance, loadsAuthorized: true, intenseSparringAuthorized: true }, '2026-11-23', '2026-11-29')
    expect(week.find((s) => s.date === '2026-11-27')!.intensity).toBe('high')
    expect(week.find((s) => s.date === '2026-11-26' && s.type === 'gym')!.activities).toContain('Remo con apoyo')
  })
})

describe('dashboard metrics', () => {
  it('summarises the current week using real durations', () => {
    const s = [
      session({ status: 'completed', result: { durationMin: 80, rpe: 7, notes: '', completedAt: '' } }),
      session({ type: 'cardio_z2', status: 'completed', durationMin: 45 }),
      session({ type: 'gym' }),
      session({ type: 'rest' }),
      session({ date: '2026-11-10', status: 'completed' }),
    ]
    expect(weekSummary(s)).toEqual({ planned: 3, completed: 2, bjjMin: 80, gymMin: 0, cardioMin: 45 })
  })
  it('computes cycle progress as elapsed time', () => {
    const p = { ...initialProfile(), id: 'me', createdAt: '', updatedAt: '', prepStartDate: '2026-11-15', competition: { ...initialProfile().competition, date: '2026-12-15' } } as AthleteProfile
    expect(cycleProgress(p)).toMatchObject({ pct: 33, daysLeft: 20 })
  })
  it('picks the next planned session in chronological order', () => {
    const later = session({ date: '2026-11-26', time: '07:00' })
    const today = session({ date: '2026-11-25', time: '19:30' })
    expect(nextSession([later, today])?.id).toBe(today.id)
  })
})

describe('strength', () => {
  it('only estimates 1RM for sets of 1-12 reps', () => {
    expect(estimated1RM(100, 1)).toBe(100)
    expect(estimated1RM(100, 10)).toBeCloseTo(133.33, 1)
    expect(estimated1RM(100, 15)).toBeNull()
  })
  it('keeps the heaviest set as personal record', () => {
    const gym = (date: string, weightKg: number, reps: number) =>
      session({ type: 'gym', status: 'completed', date, gym: { routineId: null, exercises: [{ id: 'x', exerciseId: 'hack', name: 'Hack squat', muscleGroup: 'Q', restSec: null, notes: '', sets: [{ reps, weightKg, rir: 2 }] }] } })
    const pr = personalRecords([gym('2026-11-20', 80, 8), gym('2026-11-24', 90, 5), gym('2026-11-25', 85, 8)])
    expect(pr[0]).toMatchObject({ maxWeight: 90, repsAtMax: 5, date: '2026-11-24' })
  })
})

describe('next gym session', () => {
  type S = [number, number, number | null] // kg, reps, rir
  const done = (date: string, sets: S[]) =>
    session({ type: 'gym', status: 'completed', date, gym: { routineId: null, exercises: [{ id: 'x', exerciseId: 'hack', name: 'Hack squat', muscleGroup: 'Q', restSec: null, notes: '', sets: sets.map(([weightKg, reps, rir]) => ({ weightKg, reps, rir })) }] } })
  const target = { sets: 3, reps: 8, rir: 2, weightKg: null }

  it('uses the routine target the first time', () => {
    expect(suggestNext([], 'hack', target)).toMatchObject({ action: 'first', sets: 3, reps: 8 })
    expect(suggestNext([], 'hack', null)).toBeNull()
  })
  it('adds load when every set was completed with margin', () => {
    const s = suggestNext([done('2026-11-20', [[60, 8, 2], [60, 8, 2], [60, 8, 3]])], 'hack', target)
    expect(s).toMatchObject({ action: 'increase', weightKg: 62.5, reps: 8, sets: 3 })
  })
  it('uses smaller jumps for light loads', () => {
    expect(suggestNext([done('2026-11-20', [[12, 8, 2], [12, 8, 2], [12, 8, 2]])], 'hack', target)?.weightKg).toBe(13)
  })
  it('repeats the load when it was too hard', () => {
    expect(suggestNext([done('2026-11-20', [[60, 8, 0], [60, 8, 1], [60, 8, 0]])], 'hack', target)).toMatchObject({ action: 'repeat', weightKg: 60 })
  })
  it('repeats the load when a few reps were missing', () => {
    expect(suggestNext([done('2026-11-20', [[60, 8, 1], [60, 7, 0], [60, 6, 0]])], 'hack', target)).toMatchObject({ action: 'more_reps', weightKg: 60 })
  })
  it('lowers the load when far from the target', () => {
    expect(suggestNext([done('2026-11-20', [[60, 5, 0], [60, 4, 0], [60, 4, 0]])], 'hack', target)).toMatchObject({ action: 'decrease', weightKg: 54 })
  })
  it('uses the latest session and ignores the one being edited', () => {
    const old = done('2026-11-18', [[50, 8, 2], [50, 8, 2], [50, 8, 2]])
    const recent = done('2026-11-22', [[60, 5, 0], [60, 4, 0], [60, 4, 0]])
    expect(suggestNext([recent, old], 'hack', target)?.action).toBe('decrease')
    expect(suggestNext([recent, old], 'hack', target, { excludeId: recent.id })?.weightKg).toBe(52.5)
  })
  it('never adds load with red recovery', () => {
    const s = suggestNext([done('2026-11-20', [[60, 8, 2], [60, 8, 2], [60, 8, 2]])], 'hack', target, { holdIncrease: true })
    expect(s).toMatchObject({ action: 'hold_recovery', weightKg: 60 })
  })
  it('progresses bodyweight work by reps', () => {
    expect(suggestNext([done('2026-11-20', [[0, 10, 2], [0, 10, 2], [0, 10, 2]])], 'hack', { ...target, reps: 10 })).toMatchObject({ reps: 11, weightKg: 0 })
  })
})

describe('analytics', () => {
  const w = (compliance: number | null) => ({ compliance }) as WeekStats
  it('counts consecutive complete weeks ≥ 80 %, ignoring the in-progress week', () => {
    expect(consistencyStreak([w(50), w(90), w(85), w(10)])).toBe(2)
    expect(consistencyStreak([w(90), w(70), w(100)])).toBe(1)
  })
  it('computes metric-based goal progress from records', () => {
    const s = [session({ status: 'completed' }), session({ status: 'completed', date: '2026-11-24' })]
    const g = { id: 'g', createdAt: '', updatedAt: '', week: '2026-11-23', text: '', metric: 'sessions' as const, target: 3, done: false }
    expect(goalProgress(g, s, [])).toEqual({ value: 2, target: 3 })
  })
})

describe('plan adaptation', () => {
  it('suggests lowering intensity on red recovery and flags missed sessions', () => {
    const today = session({ intensity: 'high' })
    const missed = session({ date: '2026-11-22' })
    const adj = suggestAdjustments([today, missed], [log('2026-11-25', { fatigue: 9 })], noClearance)
    expect(adj.find((a) => a.sessionId === today.id)?.patch.intensity).toBe('low')
    expect(adj.find((a) => a.sessionId === missed.id)?.kind).toBe('missed')
  })
  it('adapts sessions that need a missing authorisation', () => {
    const friday = session({ date: '2026-11-26', requiresClearance: 'intense_sparring', intensity: 'high' })
    const adj = suggestAdjustments([friday], [], noClearance)
    expect(adj[0].kind).toBe('clearance')
    expect(adj[0].patch.requiresClearance).toBeNull()
  })
})

describe('CSV export', () => {
  it('escapes separators/quotes and neutralises spreadsheet formulas', () => {
    const csv = toCSV(['a', 'b'], [['x;y', '=HYPERLINK("http://evil")'], [1.5, null]])
    const lines = csv.replace('﻿', '').split('\r\n')
    expect(lines[1]).toBe(`"x;y";"'=HYPERLINK(""http://evil"")"`)
    expect(lines[2]).toBe('1,5;')
  })
})
