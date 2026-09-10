/**
 * Minimal cache-backed data hook.
 * - data is never dropped during a refetch (cached value stays visible)
 * - `invalidate(prefix)` re-fetches every mounted query whose key starts with prefix
 * - errors are surfaced but the last good data is retained
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError } from '@/api/types'

interface Entry<T> {
  data: T | undefined
  error: ApiError | null
  loading: boolean
  refetching: boolean
  updatedAt: number
  promise: Promise<void> | null
  fetcher: (() => Promise<T>) | null
  subscribers: number
}

const cache = new Map<string, Entry<unknown>>()
const listeners = new Map<string, Set<() => void>>()

function getEntry<T>(key: string): Entry<T> {
  let e = cache.get(key) as Entry<T> | undefined
  if (!e) {
    e = { data: undefined, error: null, loading: false, refetching: false, updatedAt: 0, promise: null, fetcher: null, subscribers: 0 }
    cache.set(key, e as Entry<unknown>)
  }
  return e
}

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l())
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  return new ApiError(err instanceof Error ? err.message : 'Erreur inconnue', 'unknown')
}

export function fetchKey<T>(key: string, fetcher?: () => Promise<T>): Promise<void> {
  const e = getEntry<T>(key)
  if (fetcher) e.fetcher = fetcher
  if (!e.fetcher) return Promise.resolve()
  if (e.promise) return e.promise
  if (e.data === undefined) e.loading = true
  else e.refetching = true
  notify(key)
  const p = e
    .fetcher()
    .then((data) => {
      e.data = data
      e.error = null
      e.updatedAt = Date.now()
    })
    .catch((err) => {
      e.error = toApiError(err)
    })
    .finally(() => {
      e.loading = false
      e.refetching = false
      e.promise = null
      notify(key)
    })
  e.promise = p
  return p
}

/** Re-fetch every query whose key starts with `prefix` and has a mounted subscriber. */
export function invalidate(prefix: string) {
  for (const [key, e] of cache) {
    if (key === prefix || key.startsWith(prefix + ':') || key.startsWith(prefix + '/')) {
      if (e.subscribers > 0) void fetchKey(key)
      else e.updatedAt = 0
    }
  }
}

/** Optimistically patch cached data (e.g. insert a pending transaction). */
export function setQueryData<T>(key: string, updater: (prev: T | undefined) => T) {
  const e = getEntry<T>(key)
  e.data = updater(e.data)
  e.updatedAt = Date.now()
  notify(key)
}

export function getQueryData<T>(key: string): T | undefined {
  return (cache.get(key) as Entry<T> | undefined)?.data
}

export function clearQueryCache() {
  cache.clear()
  for (const set of listeners.values()) set.forEach((l) => l())
}

export interface QueryResult<T> {
  data: T | undefined
  error: ApiError | null
  /** true only when there is no data yet */
  loading: boolean
  /** true while refreshing with data on screen */
  refetching: boolean
  refetch: () => Promise<void>
  updatedAt: number
}

export interface QueryOptions {
  enabled?: boolean
  /** Re-fetch if data is older than this (ms). Default 0 = always on mount. */
  staleTime?: number
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, opts: QueryOptions = {}): QueryResult<T> {
  const enabled = opts.enabled !== false && key !== null
  const k = key ?? '__disabled__'
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(k)
      if (!set) {
        set = new Set()
        listeners.set(k, set)
      }
      set.add(cb)
      const e = getEntry<T>(k)
      e.subscribers += 1
      return () => {
        set!.delete(cb)
        e.subscribers -= 1
      }
    },
    [k],
  )
  const getSnapshot = useCallback(() => getEntry<T>(k), [k])
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!enabled) return
    const e = getEntry<T>(k)
    const stale = Date.now() - e.updatedAt > (opts.staleTime ?? 0)
    if ((e.data === undefined || stale) && !e.promise) void fetchKey(k, () => fetcherRef.current())
    else e.fetcher = () => fetcherRef.current()
  }, [k, enabled, opts.staleTime])

  const refetch = useCallback(() => fetchKey(k, () => fetcherRef.current()), [k])

  return {
    data: entry.data,
    error: entry.error,
    loading: enabled && entry.data === undefined && (entry.loading || (!entry.error && entry.updatedAt === 0)),
    refetching: entry.refetching,
    refetch,
    updatedAt: entry.updatedAt,
  }
}

/** Mutation helper with loading + error state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const mutate = useCallback(
    async (...args: A): Promise<R> => {
      setPending(true)
      setError(null)
      try {
        return await fn(...args)
      } catch (err) {
        const e = toApiError(err)
        setError(e)
        throw e
      } finally {
        setPending(false)
      }
    },
    [fn],
  )
  return { mutate, pending, error, reset: () => setError(null) }
}

export { toApiError }
