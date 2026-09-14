/**
 * Every switch that turns this app from a demo into a product.
 *
 * **A `VITE_` variable is public.** Vite inlines it into the JavaScript that ships to every
 * visitor, so anyone can read it with View Source. That fact decides the whole shape of
 * this file: the frontend may hold a *base URL* and a *publishable* key, and nothing else.
 * A market-data key, a KYC contract, a Wave or Orange Money secret, a custody credential —
 * those belong on a server that this app calls. Pasting one here would publish it.
 *
 * So "connecter les clés" means, concretely: stand up a backend that implements
 * `KeewalApi` over HTTP (`docs/API.md` is the endpoint list), give it the third-party
 * secrets, and point `VITE_API_URL` at it. The screens do not change — they never knew
 * which implementation they were talking to.
 *
 * Until `VITE_API_URL` is set, the app runs on `src/api/mock`, and every surface that shows
 * a number says where it came from.
 */

/** Read a variable, treating blank and the literal strings Vite users leave behind as unset. */
function read(name: string): string | undefined {
  const raw = (import.meta.env as Record<string, string | undefined>)[name]
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  if (!v || v === 'undefined' || v === 'null') return undefined
  return v
}

/**
 * Check a base URL and report what is wrong with it — but **never** withdraw it.
 *
 * A bad URL must not make the app fall back to the demo data. That failure mode is the
 * dangerous one: someone mistypes a hostname and the screens fill with invented balances
 * that look exactly like real ones. Configured-but-broken has to fail loudly, so the URL
 * is kept as given and the problem is reported on the integration screen, where it can be
 * read, while every request fails visibly.
 */
function checkUrl(name: string, raw: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return `${name} n’est pas une URL valide : « ${raw} »`
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `${name} doit être en http(s), reçu « ${parsed.protocol} »`
  }
  if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    return `${name} est en clair (http). Un appel d’argent passe en https, sauf en local.`
  }
  return undefined
}

const rawApiUrl = read('VITE_API_URL')

export interface Env {
  /** Backend implementing `KeewalApi`. Unset → the app runs on the mock. */
  apiUrl?: string
  /** Anything wrong with the configuration, in French, for the integration screen. */
  errors: string[]
  /** Build stamp, shown on the profile screen so a stale deploy is visible. */
  buildId: string
  /** True when the app is talking to a real backend. */
  live: boolean
}

const errors: string[] = []
if (rawApiUrl) {
  const problem = checkUrl('VITE_API_URL', rawApiUrl)
  if (problem) errors.push(problem)
}

export const env: Env = {
  // Trailing slashes are the classic source of `//v1/accounts`; normalise once, here.
  apiUrl: rawApiUrl?.replace(/\/+$/, ''),
  errors,
  buildId: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev',
  live: !!rawApiUrl,
}
