/**
 * The HTTP layer under `restApi`.
 *
 * Three jobs, and it exists so that no screen ever has to do any of them:
 *
 * 1. **Carry the session.** The token lives here, seeded from storage on load and updated
 *    by the auth calls, so a screen never touches a header.
 * 2. **Turn every failure into an `ApiError` with a code the UI already handles.** The
 *    screens branch on `insufficient_funds`, `validation`, `offline` and `network`; a raw
 *    `TypeError: Failed to fetch` reaching a screen would print as « Erreur inconnue » and
 *    tell the user nothing. The mapping is deliberate rather than incidental: the server's
 *    own `code` wins when it sends one, the status decides otherwise, and a request that
 *    never left the device is `offline`, not `network` — the two get different copy because
 *    one is fixed by waiting and the other is not.
 * 3. **Give up.** A money app that hangs on a dead socket is worse than one that fails: the
 *    user taps « Envoyer » again. Every request carries a timeout and aborts.
 */
import { ApiError } from '../types'
import { readJson, remove, writeJson } from '@/lib/storage'

const TOKEN_KEY = 'keewal.token'
/** Long enough for a cold serverless start, short enough that nobody taps send twice. */
const DEFAULT_TIMEOUT_MS = 15_000

let token: string | null = readJson<string | null>(TOKEN_KEY, null)

export function setToken(next: string | null) {
  token = next
  if (next) writeJson(TOKEN_KEY, next)
  else remove(TOKEN_KEY)
}

export function getToken(): string | null {
  return token
}

/** Status → the code the screens already branch on. */
function codeForStatus(status: number): ApiError['code'] {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not_found'
  if (status === 409) return 'validation'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'network'
  return 'unknown'
}

const MESSAGE_FOR_CODE: Record<ApiError['code'], string> = {
  offline: 'Vous êtes hors ligne.',
  network: 'Le service ne répond pas. Réessayez dans un instant.',
  validation: 'Ces informations ne sont pas valides.',
  insufficient_funds: 'Fonds insuffisants.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  not_found: 'Introuvable.',
  rate_limited: 'Trop de tentatives. Patientez un instant.',
  frozen: 'Cette carte est gelée.',
  unknown: 'Une erreur est survenue.',
}

interface ServerError {
  error?: { code?: string; message?: string; details?: Record<string, string> }
  message?: string
}

const KNOWN_CODES = new Set<ApiError['code']>([
  'network',
  'offline',
  'validation',
  'insufficient_funds',
  'unauthorized',
  'not_found',
  'rate_limited',
  'frozen',
  'unknown',
])

function isKnownCode(v: string | undefined): v is ApiError['code'] {
  return !!v && KNOWN_CODES.has(v as ApiError['code'])
}

export interface HttpOptions {
  baseUrl: string
  /** Injected in tests. Defaults to the global. */
  fetchFn?: typeof fetch
  timeoutMs?: number
}

export interface Http {
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  del<T>(path: string, body?: unknown): Promise<T>
  /** For the event stream, which needs the base URL and token but not the JSON handling. */
  url(path: string): string
  options: Required<Pick<HttpOptions, 'baseUrl'>> & { fetchFn: typeof fetch; timeoutMs: number }
}

export function createHttp(opts: HttpOptions): Http {
  const baseUrl = opts.baseUrl.replace(/\/+$/, '')
  const fetchFn = opts.fetchFn ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  function url(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const p = path.startsWith('/') ? path : `/${path}`
    if (!query) return baseUrl + p
    const entries = Object.entries(query).filter(([, v]) => v !== undefined && v !== '')
    if (!entries.length) return baseUrl + p
    const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
    return `${baseUrl}${p}?${qs.toString()}`
  }

  async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    // A request that never leaves the device is not a network failure — it is an offline
    // one, and the UI says something different (and keeps the cached data on screen).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError(MESSAGE_FOR_CODE.offline, 'offline')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetchFn(url(path, query), {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (e) {
      // An abort is our own timeout, not the user's cancel: there is no cancel button.
      const aborted = e instanceof Error && e.name === 'AbortError'
      throw new ApiError(aborted ? 'Le service met trop de temps à répondre.' : MESSAGE_FOR_CODE.network, 'network')
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 204) return undefined as T

    let payload: unknown
    const text = await res.text().catch(() => '')
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = undefined
      }
    }

    if (!res.ok) {
      const sent = (payload ?? {}) as ServerError
      // The server knows why it refused — "fonds insuffisants" is a 409 that only it can
      // tell apart from a duplicate. Its code wins; the status is the fallback.
      const code = isKnownCode(sent.error?.code) ? sent.error.code : codeForStatus(res.status)
      const message = sent.error?.message ?? sent.message ?? MESSAGE_FOR_CODE[code]
      if (code === 'unauthorized') setToken(null)
      throw new ApiError(message, code, sent.error?.details)
    }

    return payload as T
  }

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path, body) => request('DELETE', path, body),
    url: (path) => url(path),
    options: { baseUrl, fetchFn, timeoutMs },
  }
}
