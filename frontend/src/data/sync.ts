import { useSyncExternalStore } from 'react'
import type { Entity } from '@/types/domain'
import { ALL_STORES } from './index'
import { DATA_MODE, readTombstones, writeTombstones } from './adapters'
import { PROFILE_ID } from './seed'
import { collectionFingerprint, fingerprint, mergeData, type SyncData } from './syncMerge'

/**
 * Cloud sync for the local (GitHub Pages) mode: every device keeps its data in the browser and
 * merges it with a JSON file in a PRIVATE GitHub repository of the athlete. Free, no server.
 * The token is stored only in this browser (never in the code, the backups or the synced file).
 */

const CONFIG_KEY = 'ajp-fighter-os:sync'
const FILE = 'ajp-fighter-os-datos.json'
const API = 'https://api.github.com'

export interface SyncConfig {
  repo: string // "usuario/repositorio"
  token: string
}

export interface SyncStatus {
  configured: boolean
  repo: string | null
  state: 'idle' | 'syncing' | 'ok' | 'error'
  lastSync: string | null
  error: string | null
}

// ---------- config ----------

function loadConfig(): (SyncConfig & { lastSync?: string }) | null {
  if (DATA_MODE !== 'local') return null
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as (SyncConfig & { lastSync?: string }) | null
    return c?.repo && c?.token ? c : null
  } catch {
    return null
  }
}

function saveConfig(c: (SyncConfig & { lastSync?: string }) | null) {
  if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  else localStorage.removeItem(CONFIG_KEY)
}

export function isSyncConfigured() {
  return loadConfig() !== null
}

/** Suggested repository name: on GitHub Pages the owner is in the host name. */
export function suggestedRepo(): string {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname)
  return m ? `${m[1]}/ajp-fighter-os-datos` : ''
}

// ---------- observable status ----------

let status: SyncStatus = initialStatus()
const listeners = new Set<() => void>()

function initialStatus(): SyncStatus {
  const c = loadConfig()
  return { configured: !!c, repo: c?.repo ?? null, state: 'idle', lastSync: c?.lastSync ?? null, error: null }
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

// ---------- GitHub client ----------

export class SyncError extends Error {
  readonly conflict: boolean
  constructor(message: string, conflict = false) {
    super(message)
    this.conflict = conflict
  }
}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

async function gh(cfg: SyncConfig, path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(`${API}/repos/${cfg.repo}${path}`, {
      ...init,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new SyncError(ctrl.signal.aborted ? 'GitHub no responde (tiempo agotado)' : 'Sin conexión: se sincronizará cuando vuelva internet')
  } finally {
    clearTimeout(timer)
  }
}

function failure(res: Response, writing = false): SyncError {
  if (res.status === 401) return new SyncError('El token no es válido o ha caducado. Crea uno nuevo y vuelve a conectar.')
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return new SyncError('GitHub ha limitado las peticiones; se reintentará más tarde')
  if (res.status === 403 || (writing && res.status === 404))
    return new SyncError('El token no tiene permiso de escritura (Contents: Read and write) en ese repositorio')
  if (res.status === 404) return new SyncError('No se encuentra el repositorio o el token no tiene acceso a él')
  if (res.status === 409 || res.status === 422) return new SyncError('Los datos cambiaron en otro dispositivo', true)
  return new SyncError(`GitHub respondió con un error (${res.status})`)
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function parseRemote(text: string): SyncData {
  let raw: { app?: string; collections?: unknown; deleted?: unknown }
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SyncError('El archivo de la nube está dañado (no es JSON)')
  }
  if (raw?.app !== 'ajp-fighter-os' || !raw.collections || typeof raw.collections !== 'object') throw new SyncError('El archivo de la nube no es de AJP Fighter OS')
  const collections: Record<string, Entity[]> = {}
  for (const [name, items] of Object.entries(raw.collections as Record<string, unknown>)) {
    if (!(name in ALL_STORES)) continue
    if (!Array.isArray(items) || !items.every((i) => i && typeof i === 'object' && typeof (i as Entity).id === 'string'))
      throw new SyncError(`La colección «${name}» de la nube está dañada`)
    collections[name] = items as Entity[]
  }
  const deleted = raw.deleted && typeof raw.deleted === 'object' ? (raw.deleted as SyncData['deleted']) : {}
  return { collections, deleted }
}

async function checkRepo(cfg: SyncConfig) {
  const res = await gh(cfg, '')
  if (!res.ok) throw failure(res)
  const repo = (await res.json()) as { private?: boolean }
  if (repo.private === false) throw new SyncError('Ese repositorio es PÚBLICO: cualquiera vería tus datos. Usa un repositorio privado.')
}

async function readRemote(cfg: SyncConfig): Promise<{ data: SyncData | null; sha?: string }> {
  const res = await gh(cfg, `/contents/${FILE}`)
  if (res.status === 404) {
    await checkRepo(cfg) // distinguishes "no file yet" from "no access to the repo"
    return { data: null }
  }
  if (!res.ok) throw failure(res)
  const file = (await res.json()) as { sha: string; content?: string; size?: number }
  let b64 = file.content ?? ''
  if (!b64 && (file.size ?? 0) > 0) {
    // Files over 1 MB come without content: read the blob instead.
    const blob = await gh(cfg, `/git/blobs/${file.sha}`)
    if (!blob.ok) throw failure(blob)
    b64 = ((await blob.json()) as { content: string }).content
  }
  return { data: parseRemote(fromBase64(b64)), sha: file.sha }
}

async function writeRemote(cfg: SyncConfig, data: SyncData, sha?: string) {
  const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'móvil' : 'ordenador'
  const body = { app: 'ajp-fighter-os', version: 1, updatedAt: new Date().toISOString(), ...data }
  const res = await gh(cfg, `/contents/${FILE}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Sincronización desde ${device}`, content: toBase64(JSON.stringify(body)), ...(sha ? { sha } : {}) }),
  }, 30000)
  if (!res.ok) throw failure(res, true)
}

// ---------- local side ----------

type AnyStore = { getSnapshot: () => Entity[]; applySynced: (x: Entity[]) => void; flush: () => Promise<unknown>; subscribe: (l: () => void) => () => void }
const stores = () => Object.entries(ALL_STORES) as unknown as [string, AnyStore][]

let applying = false

const flushAll = () => Promise.all(stores().map(([, s]) => s.flush()))

function localData(): SyncData {
  return {
    collections: Object.fromEntries(stores().map(([name, s]) => [name, s.getSnapshot()])),
    deleted: readTombstones() as SyncData['deleted'],
  }
}

function applyLocal(data: SyncData) {
  applying = true
  try {
    for (const [name, store] of stores()) {
      const next = data.collections[name] ?? []
      if (collectionFingerprint(next) !== collectionFingerprint(store.getSnapshot())) store.applySynced(next)
    }
    writeTombstones(data.deleted)
  } finally {
    applying = false
  }
}

// ---------- sync ----------

async function syncOnce(cfg: SyncConfig) {
  for (let attempt = 0; ; attempt++) {
    await flushAll()
    const remote = await readRemote(cfg)
    await flushAll()
    const merged = mergeData(localData(), remote.data ?? { collections: {}, deleted: {} })
    applyLocal(merged)
    if (remote.data && fingerprint(merged) === fingerprint(remote.data)) return
    try {
      await writeRemote(cfg, merged, remote.sha)
      return
    } catch (e) {
      // Another device wrote in between: read again and merge with its changes.
      if (!(e instanceof SyncError && e.conflict) || attempt >= 3) throw e
    }
  }
}

let running: Promise<void> | null = null
let again = false

async function runSync(): Promise<void> {
  const cfg = loadConfig()
  if (!cfg) return
  setStatus({ state: 'syncing' })
  try {
    await syncOnce(cfg)
    const lastSync = new Date().toISOString()
    saveConfig({ ...cfg, lastSync })
    setStatus({ state: 'ok', lastSync, error: null })
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : 'No se pudo sincronizar' })
    throw e
  }
}

/** Syncs now. Never throws: problems are reported in the status. */
export function syncNow(): Promise<void> {
  if (!loadConfig()) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = runSync()
    .catch(() => undefined)
    .finally(() => {
      running = null
      if (again) {
        again = false
        void syncNow()
      }
    })
  return running
}

/** What the cloud holds, to decide how to connect a device. */
export async function probeCloud(cfg: SyncConfig): Promise<{ hasData: boolean; records: number }> {
  const repo = cfg.repo.trim()
  if (!REPO_RE.test(repo)) throw new SyncError('Escribe el repositorio como usuario/nombre')
  if (!cfg.token.trim()) throw new SyncError('Falta el token')
  const c = { repo, token: cfg.token.trim() }
  await checkRepo(c)
  const { data } = await readRemote(c)
  const hasData = !!data?.collections.profile?.some((p) => p.id === PROFILE_ID)
  return { hasData, records: data ? Object.values(data.collections).reduce((a, x) => a + x.length, 0) : 0 }
}

/**
 * Connects this device. `cloud`: this device takes the cloud data and discards its own (new device).
 * `merge`: both are combined (records are never lost, but the initial plans may be duplicated).
 */
export async function connectSync(cfg: SyncConfig, mode: 'cloud' | 'merge') {
  const c = { repo: cfg.repo.trim(), token: cfg.token.trim() }
  if (mode === 'cloud') {
    const { data } = await readRemote(c)
    if (!data) throw new SyncError('La nube está vacía')
    await flushAll()
    applyLocal({ collections: Object.fromEntries(stores().map(([name]) => [name, data.collections[name] ?? []])), deleted: data.deleted })
    await flushAll()
  }
  saveConfig(c)
  setStatus({ configured: true, repo: c.repo, error: null })
  await runSync()
}

/** Forgets the token on this device. Local data and the cloud file are kept. */
export function disconnectSync() {
  saveConfig(null)
  setStatus({ configured: false, repo: null, state: 'idle', lastSync: null, error: null })
}

/** Keeps the device in sync: shortly after each change, when the app comes back to the foreground and every minute. */
export function startAutoSync(): () => void {
  if (DATA_MODE !== 'local') return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    if (applying || !loadConfig()) return
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 2500)
  }
  const unsubs = stores().map(([, s]) => s.subscribe(soon))
  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  const onOnline = () => void syncNow()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  const interval = setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000)
  return () => {
    clearTimeout(timer)
    clearInterval(interval)
    unsubs.forEach((u) => u())
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}
