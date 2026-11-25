import { useSyncExternalStore } from 'react'
import { api, tokenStorage } from './http'
import { DATA_MODE } from './adapters'

export interface User {
  id: string
  email: string
  name: string
}

interface AuthResponse {
  token: string
  user: User
}

type AuthState = { status: 'checking' } | { status: 'anonymous' } | { status: 'authenticated'; user: User }

let state: AuthState = DATA_MODE === 'local'
  ? { status: 'authenticated', user: { id: 'local', email: '', name: 'Modo local' } }
  : { status: 'checking' }
const listeners = new Set<() => void>()
const setState = (s: AuthState) => {
  state = s
  listeners.forEach((l) => l())
}

export const useAuth = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )

/** Restores the session from a stored token. */
export async function restoreSession() {
  if (DATA_MODE === 'local') return
  if (!tokenStorage.get()) return setState({ status: 'anonymous' })
  try {
    setState({ status: 'authenticated', user: await api<User>('/auth/me') })
  } catch {
    tokenStorage.clear()
    setState({ status: 'anonymous' })
  }
}

async function authenticate(path: string, body: unknown) {
  const r = await api<AuthResponse>(path, { method: 'POST', body })
  tokenStorage.set(r.token)
  setState({ status: 'authenticated', user: r.user })
}

export const login = (email: string, password: string) => authenticate('/auth/login', { email, password })
export const register = (name: string, email: string, password: string) =>
  authenticate('/auth/register', { name, email, password })

export function logout() {
  tokenStorage.clear()
  setState({ status: 'anonymous' })
}

export function markSessionExpired() {
  if (state.status === 'authenticated' && DATA_MODE === 'api') setState({ status: 'anonymous' })
}
