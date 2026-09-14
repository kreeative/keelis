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
 *    one is fixed by waiting and the other is not. Its *message* is shown for a refusal and
 *    never for a fault: see `messageFor`.
 * 3. **Give up.** A money app that hangs on a dead socket is worse than one that fails: the
 *    user taps « Envoyer » again. Every request carries a timeout and aborts — and a reply
 *    that is not JSON fails here rather than travelling onward as `undefined`.
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

/**
 * Whose sentence the user reads.
 *
 * `docs/API.md` says `message` « est affiché tel quel », and for a **refusal** that is
 * exactly right: a 4xx is the server having considered the request and declined it, and it
 * wrote that line for the person who has to act on it. « Solde insuffisant » is a 409 that
 * nothing on this side can tell apart from a duplicate, and « IBAN invalide » names a field
 * only the server could have checked. Those words are the correct ones and no generic
 * sentence improves them.
 *
 * A **5xx is not a refusal, it is a fault**, and its `message` is a log line. A
 * half-deployed service answering `{"message":"boom"}` put the word « boom » on screen
 * where the app's own sentence belonged; so would a stack fragment, an ORM's complaint
 * about a column, or a proxy's English. None of that is copy, none of it is French, and
 * none of it says what to do — which is all the contract asks a message to be. The status
 * decides this, not the `code`: a service that is failing can also mislabel the failure.
 *
 * The length bound is the same argument from the other end. A `message` measured in
 * kilobytes is a stack trace whatever the status said, and rendering it destroys the screen
 * it was meant to explain.
 */
const MAX_SERVER_MESSAGE = 200

function messageFor(sent: ServerError, status: number, code: ApiError['code']): string {
  const ours = MESSAGE_FOR_CODE[code]
  if (status >= 500) return ours
  const theirs = sent.error?.message ?? sent.message
  if (!theirs || theirs.length > MAX_SERVER_MESSAGE) return ours
  return theirs
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
    let unparseable = false
    const text = await res.text().catch(() => '')
    // An empty 200 is a legitimate void — several endpoints acknowledge and return nothing.
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        unparseable = true
      }
    }

    /* A 200 whose body is not JSON is a configuration fault, and it has to fail here.
       Returning `undefined` sent it onward as *data*: the onboarding screen read `.step`
       off it and threw, the route boundary caught that and said « Vérifiez votre
       connexion » — blaming the network for a URL pointing at the wrong place. It is the
       likeliest mistake anybody makes on the first day, because an API URL aimed at the
       app's own origin answers every path with `index.html`, status 200. The user gets the
       ordinary « service ne répond pas » sentence; the console gets the actual diagnosis,
       because that is who can act on it. */
    if (unparseable && res.ok) {
      console.error(
        `[keewal] ${method} ${url(path, query)} answered ${res.status} with ${res.headers.get('content-type') ?? 'no content type'} instead of JSON — ` +
          `is VITE_API_URL pointing at the API rather than at the app? Body began: ${text.slice(0, 80)}`,
      )
      throw new ApiError(MESSAGE_FOR_CODE.network, 'network')
    }

    if (!res.ok) {
      const sent = (payload ?? {}) as ServerError
      // The server knows why it refused — "fonds insuffisants" is a 409 that only it can
      // tell apart from a duplicate. Its code wins; the status is the fallback.
      // Narrowed into a value rather than a boolean: `classified ? sent.error.code : …`
      // through a separate flag leaves TypeScript with `string | undefined`.
      const coded: ApiError['code'] | null = isKnownCode(sent.error?.code) ? sent.error.code : null
      const code = coded ?? codeForStatus(res.status)
      if (code === 'unauthorized') setToken(null)
      throw new ApiError(messageFor(sent, res.status, code), code, sent.error?.details)
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
