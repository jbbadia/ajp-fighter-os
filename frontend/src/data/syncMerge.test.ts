import { describe, expect, it } from 'vitest'
import type { Entity } from '@/types/domain'
import { fingerprint, mergeData, type SyncData } from './syncMerge'

const e = (id: string, updatedAt: string, extra: Record<string, unknown> = {}): Entity => ({ id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt, ...extra })
const data = (sessions: Entity[], deleted: Record<string, string> = {}): SyncData => ({ collections: { sessions }, deleted: Object.keys(deleted).length ? { sessions: deleted } : {} })
const now = new Date('2026-11-25T12:00:00.000Z')

describe('cloud sync merge', () => {
  it('keeps records created on either device', () => {
    const m = mergeData(data([e('pc', '2026-11-20T10:00:00.000Z')]), data([e('movil', '2026-11-21T10:00:00.000Z')]), now)
    expect(m.collections.sessions.map((s) => s.id).sort()).toEqual(['movil', 'pc'])
  })

  it('the most recent edit of the same record wins, whichever side it is on', () => {
    const old = e('s1', '2026-11-20T10:00:00.000Z', { notes: 'vieja' })
    const recent = e('s1', '2026-11-22T10:00:00.000Z', { notes: 'nueva' })
    expect(mergeData(data([old]), data([recent]), now).collections.sessions[0]).toMatchObject({ notes: 'nueva' })
    expect(mergeData(data([recent]), data([old]), now).collections.sessions[0]).toMatchObject({ notes: 'nueva' })
  })

  it('a deletion on one device removes the record on the other', () => {
    const m = mergeData(data([], { s1: '2026-11-23T10:00:00.000Z' }), data([e('s1', '2026-11-20T10:00:00.000Z')]), now)
    expect(m.collections.sessions).toEqual([])
    expect(m.deleted.sessions).toEqual({ s1: '2026-11-23T10:00:00.000Z' })
  })

  it('an edit made after the deletion keeps the record', () => {
    const m = mergeData(data([], { s1: '2026-11-20T10:00:00.000Z' }), data([e('s1', '2026-11-23T10:00:00.000Z')]), now)
    expect(m.collections.sessions.map((s) => s.id)).toEqual(['s1'])
    expect(m.deleted.sessions).toBeUndefined()
  })

  it('forgets very old deletions', () => {
    const m = mergeData(data([], { viejo: '2026-01-01T00:00:00.000Z', reciente: '2026-11-01T00:00:00.000Z' }), data([]), now)
    expect(m.deleted.sessions).toEqual({ reciente: '2026-11-01T00:00:00.000Z' })
  })

  it('is stable: merging again changes nothing, so nothing is re-uploaded', () => {
    const a = data([e('a', '2026-11-20T10:00:00.000Z'), e('b', '2026-11-21T10:00:00.000Z')], { c: '2026-11-22T10:00:00.000Z' })
    const b = data([e('b', '2026-11-24T10:00:00.000Z'), e('d', '2026-11-21T10:00:00.000Z')])
    const m = mergeData(a, b, now)
    expect(fingerprint(mergeData(m, b, now))).toBe(fingerprint(m))
    expect(fingerprint(mergeData(b, a, now))).toBe(fingerprint(m))
  })
})
