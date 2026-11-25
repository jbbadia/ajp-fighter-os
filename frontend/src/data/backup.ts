import type { Entity } from '@/types/domain'
import { ALL_STORES } from './index'
import { DATA_MODE } from './adapters'
import { api } from './http'
import { PROFILE_ID } from './seed'

const APP = 'ajp-fighter-os'
const VERSION = 1

export function buildBackup() {
  return {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    collections: Object.fromEntries(Object.entries(ALL_STORES).map(([k, s]) => [k, s.getSnapshot()])),
  }
}

/** Validates and restores a backup, replacing every collection. Throws with a readable message. */
export async function restoreBackup(raw: string) {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }
  const b = data as { app?: string; version?: number; collections?: Record<string, unknown> }
  if (b?.app !== APP || typeof b.collections !== 'object' || !b.collections) throw new Error('El archivo no es una copia de seguridad de AJP Fighter OS')
  if ((b.version ?? 0) > VERSION) throw new Error('La copia es de una versión más reciente de la aplicación')

  const cols: Record<string, Entity[]> = {}
  for (const [name, items] of Object.entries(b.collections)) {
    if (!(name in ALL_STORES)) continue
    if (!Array.isArray(items) || !items.every((i) => i && typeof i === 'object' && typeof (i as Entity).id === 'string')) {
      throw new Error(`La colección «${name}» está dañada`)
    }
    cols[name] = items as Entity[]
  }
  if (!cols.profile?.some((p) => p.id === PROFILE_ID)) throw new Error('La copia no contiene el perfil del deportista')

  type AnyStore = { replaceAll: (x: Entity[]) => void; hydrate: () => Promise<void>; flush: () => Promise<unknown> }
  const stores = Object.entries(ALL_STORES) as unknown as [string, AnyStore][]
  if (DATA_MODE === 'api') {
    // Pending writes must land first so they do not overwrite the restored data afterwards.
    await Promise.all(stores.map(([, s]) => s.flush()))
    // The server validates and swaps everything atomically, then we reload.
    await api('/backup', { method: 'PUT', body: { app: APP, version: VERSION, collections: cols } })
    await Promise.all(stores.map(([, s]) => s.hydrate()))
  } else {
    for (const [name, store] of stores) store.replaceAll(cols[name] ?? [])
  }
}
