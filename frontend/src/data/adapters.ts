import type { Entity } from '@/types/domain'
import { api } from './http'

export type CollectionName =
  | 'profile'
  | 'sessions'
  | 'dailyLogs'
  | 'exercises'
  | 'routines'
  | 'techniques'
  | 'nutrition'
  | 'supplements'
  | 'supplementIntakes'
  | 'goals'
  | 'simulations'

/**
 * Persistence boundary. The UI never talks to storage directly.
 * `api` mode (default): Spring Boot REST API. `local` mode: browser localStorage (offline/demo).
 */
export interface PersistenceAdapter {
  load<T extends Entity>(collection: CollectionName): Promise<T[]>
  upsert<T extends Entity>(collection: CollectionName, item: T): Promise<void>
  remove(collection: CollectionName, id: string): Promise<void>
}

export type DataMode = 'api' | 'local'
export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'api'

const PREFIX = 'ajp-fighter-os:v1:'

export class LocalStorageAdapter implements PersistenceAdapter {
  private read<T>(collection: CollectionName): T[] {
    const raw = localStorage.getItem(PREFIX + collection)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      console.error(`Datos corruptos en ${collection}; se ignoran.`)
      return []
    }
  }

  private write<T>(collection: CollectionName, items: T[]) {
    localStorage.setItem(PREFIX + collection, JSON.stringify(items))
  }

  async load<T extends Entity>(collection: CollectionName): Promise<T[]> {
    return this.read<T>(collection)
  }

  async upsert<T extends Entity>(collection: CollectionName, item: T): Promise<void> {
    const items = this.read<T>(collection)
    const i = items.findIndex((x) => x.id === item.id)
    if (i >= 0) items[i] = item
    else items.push(item)
    this.write(collection, items)
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    this.write(
      collection,
      this.read<Entity>(collection).filter((x) => x.id !== id),
    )
  }
}

/** REST adapter for the Spring Boot backend (`/api/collections/{name}`). */
export class RestAdapter implements PersistenceAdapter {
  load<T extends Entity>(collection: CollectionName): Promise<T[]> {
    return api<T[]>(`/collections/${collection}`)
  }

  async upsert<T extends Entity>(collection: CollectionName, item: T): Promise<void> {
    await api(`/collections/${collection}/${encodeURIComponent(item.id)}`, { method: 'PUT', body: item })
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    await api(`/collections/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
}

export function createAdapter(): PersistenceAdapter {
  return DATA_MODE === 'local' ? new LocalStorageAdapter() : new RestAdapter()
}
