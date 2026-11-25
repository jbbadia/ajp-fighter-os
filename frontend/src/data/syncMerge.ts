import type { Entity } from '@/types/domain'

/** Everything that travels between devices: the records plus when each deleted record was removed. */
export interface SyncData {
  collections: Record<string, Entity[]>
  deleted: Record<string, Record<string, string>>
}

const TOMBSTONE_TTL_DAYS = 180

/**
 * Combines two copies of the data. Per record, the most recent edit (updatedAt) wins;
 * a deletion wins over any edit made before it. Pure and deterministic.
 */
export function mergeData(a: SyncData, b: SyncData, now = new Date()): SyncData {
  const cutoff = new Date(now.getTime() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString()
  const names = new Set([...Object.keys(a.collections), ...Object.keys(b.collections), ...Object.keys(a.deleted), ...Object.keys(b.deleted)])
  const out: SyncData = { collections: {}, deleted: {} }

  for (const name of [...names].sort()) {
    const deleted: Record<string, string> = {}
    for (const src of [a.deleted[name] ?? {}, b.deleted[name] ?? {}]) {
      for (const [id, at] of Object.entries(src)) if (!deleted[id] || at > deleted[id]) deleted[id] = at
    }

    const byId = new Map<string, Entity>()
    for (const item of [...(a.collections[name] ?? []), ...(b.collections[name] ?? [])]) {
      const prev = byId.get(item.id)
      if (!prev || (item.updatedAt ?? '') > (prev.updatedAt ?? '')) byId.set(item.id, item)
    }

    const items: Entity[] = []
    for (const item of byId.values()) {
      const del = deleted[item.id]
      if (del && del >= (item.updatedAt ?? '')) continue
      if (del) delete deleted[item.id] // edited again after the deletion: it stays
      items.push(item)
    }
    // Old deletions are forgotten so the file does not grow forever.
    for (const [id, at] of Object.entries(deleted)) if (at < cutoff) delete deleted[id]

    out.collections[name] = items
    if (Object.keys(deleted).length) out.deleted[name] = deleted
  }
  return out
}

/** Compact fingerprint: two copies with the same fingerprint hold the same versions of the same records. */
export function fingerprint(d: SyncData): string {
  const parts: string[] = []
  for (const name of Object.keys(d.collections).sort()) {
    const items = d.collections[name]
    if (!items.length) continue
    parts.push(name + ':' + items.map((i) => `${i.id}@${i.updatedAt ?? ''}`).sort().join(','))
  }
  for (const name of Object.keys(d.deleted).sort()) {
    const ids = Object.entries(d.deleted[name])
    if (ids.length) parts.push('-' + name + ':' + ids.map(([id, at]) => `${id}@${at}`).sort().join(','))
  }
  return parts.join('|')
}

/** Fingerprint of a single collection's records, to know whether it needs rewriting locally. */
export function collectionFingerprint(items: Entity[]): string {
  return items.map((i) => `${i.id}@${i.updatedAt ?? ''}`).sort().join(',')
}
