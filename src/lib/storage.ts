/** Small safe wrapper around localStorage (never throws). */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
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
