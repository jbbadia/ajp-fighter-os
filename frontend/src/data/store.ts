import { useSyncExternalStore } from 'react'
import type { Entity } from '@/types/domain'
import { nowISO, uid } from '@/lib/utils'
import type { CollectionName, PersistenceAdapter } from './adapters'

type Listener = () => void
export type NewEntity<T extends Entity> = Omit<T, keyof Entity> & Partial<Pick<T, 'id'>>

/**
 * In-memory, observable collection with optimistic writes to a persistence adapter.
 * The UI reads synchronously (useSyncExternalStore); writes are persisted async and
 * serialised per collection so they reach the backend in the order they were made.
 */
export class CollectionStore<T extends Entity> {
  private items: T[] = []
  private listeners = new Set<Listener>()
  private queue: Promise<unknown> = Promise.resolve()
  readonly name: CollectionName
  private readonly adapter: PersistenceAdapter
  onError: (error: unknown) => void = (e) => console.error(e)

  constructor(name: CollectionName, adapter: PersistenceAdapter) {
    this.name = name
    this.adapter = adapter
  }

  async hydrate() {
    this.items = await this.adapter.load<T>(this.name)
    this.emit()
  }

  clear() {
    this.items = []
    this.emit()
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.items

  get(id: string): T | undefined {
    return this.items.find((x) => x.id === id)
  }

  create(data: NewEntity<T>): T {
    const now = nowISO()
    const item = { ...data, id: data.id ?? uid(), createdAt: now, updatedAt: now } as T
    this.commit(item)
    return item
  }

  update(id: string, patch: Partial<Omit<T, keyof Entity>>): T {
    const current = this.get(id)
    if (!current) throw new Error(`${this.name}: no existe el registro ${id}`)
    const item = { ...current, ...patch, updatedAt: nowISO() }
    this.commit(item)
    return item
  }

  remove(id: string) {
    this.items = this.items.filter((x) => x.id !== id)
    this.emit()
    this.persist(() => this.adapter.remove(this.name, id))
  }

  /** Replace the whole collection (backup restore). */
  replaceAll(items: T[]) {
    const keep = new Set(items.map((i) => i.id))
    const removed = this.items.filter((i) => !keep.has(i.id))
    this.items = [...items]
    this.emit()
    removed.forEach((r) => this.persist(() => this.adapter.remove(this.name, r.id)))
    items.forEach((i) => this.persist(() => this.adapter.upsert(this.name, i)))
  }

  /** Resolves when every pending write has been attempted. */
  flush(): Promise<unknown> {
    return this.queue
  }

  private commit(item: T) {
    const exists = this.items.some((x) => x.id === item.id)
    this.items = exists ? this.items.map((x) => (x.id === item.id ? item : x)) : [...this.items, item]
    this.emit()
    this.persist(() => this.adapter.upsert(this.name, item))
  }

  private persist(op: () => Promise<void>) {
    this.queue = this.queue.then(op).catch(this.onError)
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }
}

export function useCollection<T extends Entity>(store: CollectionStore<T>): T[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
