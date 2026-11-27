import { describe, expect, it } from 'vitest'
import type { RehabLog } from '@/types/domain'
import { DERBY_S1, DERBY_S2, rehabStreak, s1Achieved, s1Name, s2Achieved, sessionsOn } from './rehab'

const log = (date: string, p: Partial<RehabLog> = {}): RehabLog => ({
  id: Math.random().toString(36).slice(2), createdAt: '', updatedAt: '', date, program: 'derby', s1: null, s2: null, notes: '', ...p,
})

describe('shoulder rehab (Derby programme)', () => {
  it('follows the order and targets of the document', () => {
    expect(DERBY_S1.map((e) => e.target)).toEqual([100, 100, 100, 100, 50, 50, 20, 20])
    expect(DERBY_S2).toHaveLength(6)
    expect(DERBY_S2.every((e) => e.target === 60)).toBe(true)
  })
  it('section 1 target is reached with the target reps', () => {
    expect(s1Achieved(log('2026-11-27', { s1: { index: 0, reps: 100 } }))).toBe(true)
    expect(s1Achieved(log('2026-11-27', { s1: { index: 0, reps: 99 } }))).toBe(false)
    expect(s1Achieved(log('2026-11-27', { s1: { index: 6, reps: 20 } }))).toBe(true)
  })
  it('section 2 target needs the 5 repetitions at 60 s', () => {
    const holds = (s: number[]) => s.map((seconds) => ({ seconds }))
    expect(s2Achieved(log('2026-11-27', { s2: { index: 0, holds: holds([60, 60, 60, 60, 60]) } }))).toBe(true)
    expect(s2Achieved(log('2026-11-27', { s2: { index: 0, holds: holds([60, 60, 60, 60, 45]) } }))).toBe(false)
    expect(s2Achieved(log('2026-11-27', { s2: { index: 0, holds: holds([60, 60]) } }))).toBe(false)
  })
  it('exercise 4 follows the instability type set by the physio', () => {
    expect(s1Name(3, 'anterior')).toMatch(/AER/)
    expect(s1Name(3, 'posterior')).toMatch(/AIR/)
    expect(s1Name(3, null)).toMatch(/AER \/ AIR/)
  })
  it('counts sessions per day and the streak of days', () => {
    const logs = [log('2026-11-27'), log('2026-11-27'), log('2026-11-26'), log('2026-11-24')]
    expect(sessionsOn(logs, '2026-11-27')).toBe(2)
    expect(rehabStreak(logs, '2026-11-27')).toBe(2)
    expect(rehabStreak(logs, '2026-11-28')).toBe(2) // today still pending
    expect(rehabStreak([], '2026-11-27')).toBe(0)
  })
})
