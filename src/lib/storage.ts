/**
 * Small safe wrapper around localStorage (never throws).
 *
 * It also carries the app's old storage prefix across. The product was called Keelis and
 * its keys were `keelis.*`; renaming them without a migration would have signed everyone
 * out and dropped their PIN, theme and locale on the floor — a rename is a marketing
 * decision and must not cost a user their session.
 */
const OLD_PREFIX = 'keelis.'
const NEW_PREFIX = 'keewal.'

/** Read the new key, falling back to the old one and moving it across on the way. */
function resolve(key: string): string | null {
  try {
    const current = localStorage.getItem(key)
    if (current !== null) return current
    if (!key.startsWith(NEW_PREFIX)) return null
    const legacy = localStorage.getItem(OLD_PREFIX + key.slice(NEW_PREFIX.length))
    if (legacy === null) return null
    localStorage.setItem(key, legacy)
    localStorage.removeItem(OLD_PREFIX + key.slice(NEW_PREFIX.length))
    return legacy
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = resolve(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy errors */
  }
}
export function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
