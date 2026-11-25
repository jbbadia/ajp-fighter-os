const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const TOKEN_KEY = 'ajp-fighter-os:token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>
  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** Called when the API answers 401 (expired/invalid session). */
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStorage.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor')
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    tokenStorage.clear()
    onUnauthorized()
  }
  if (!res.ok) {
    let message = `Error ${res.status}`
    let fieldErrors: Record<string, string> = {}
    try {
      const problem = (await res.json()) as { message?: string; detail?: string; fieldErrors?: Record<string, string> }
      message = problem.message ?? problem.detail ?? message
      fieldErrors = problem.fieldErrors ?? {}
    } catch {
      /* body without JSON */
    }
    throw new ApiError(res.status, message, fieldErrors)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}
