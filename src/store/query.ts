/**
 * Minimal cache-backed data hook.
 * - data is never dropped during a refetch (cached value stays visible)
 * - `invalidate(prefix)` re-fetches every mounted query whose key starts with prefix
 * - errors are surfaced but the last good data is retained
 *
 * Snapshot identity: every state change replaces `entry.snapshot` with a NEW object, so
 * useSyncExternalStore's Object.is comparison sees the change and re-renders. Never mutate
 * a snapshot in place — go through `commit()`.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError } from '@/api/types'

export interface QuerySnapshot<T> {
  data: T | undefined
  error: ApiError | null
  loading: boolean
  refetching: boolean
  updatedAt: number
}

interface Entry<T> {
  snapshot: QuerySnapshot<T>
  promise: Promise<void> | null
  fetcher: (() => Promise<T>) | null
  subscribers: number
}

const EMPTY: QuerySnapshot<unknown> = { data: undefined, error: null, loading: false, refetching: false, updatedAt: 0 }

const cache = new Map<string, Entry<unknown>>()
const listeners = new Map<string, Set<() => void>>()

function getEntry<T>(key: string): Entry<T> {
  let e = cache.get(key) as Entry<T> | undefined
  if (!e) {
    e = { snapshot: EMPTY as QuerySnapshot<T>, promise: null, fetcher: null, subscribers: 0 }
    cache.set(key, e as Entry<unknown>)
  }
  return e
}

function notify(key: string) {
  const set = listeners.get(key)
  if (set) for (const l of Array.from(set)) l()
}

/** Replace the snapshot with a new object and notify subscribers. */
function commit<T>(key: string, patch: Partial<QuerySnapshot<T>>) {
  const e = getEntry<T>(key)
  e.snapshot = { ...e.snapshot, ...patch }
  notify(key)
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
  commit<T>(key, e.snapshot.data === undefined ? { loading: true } : { refetching: true })
  const p = e
    .fetcher()
    .then((data) => {
      commit<T>(key, { data, error: null, updatedAt: Date.now() })
    })
    .catch((err) => {
      commit<T>(key, { error: toApiError(err) })
    })
    .finally(() => {
      e.promise = null
      commit<T>(key, { loading: false, refetching: false })
    })
  e.promise = p
  return p
}

/** Re-fetch every query whose key starts with `prefix` and has a mounted subscriber. */
export function invalidate(prefix: string) {
  for (const [key, e] of cache) {
    if (key === prefix || key.startsWith(prefix + ':') || key.startsWith(prefix + '/')) {
      if (e.subscribers > 0) void fetchKey(key)
      else e.snapshot = { ...e.snapshot, updatedAt: 0 }
    }
  }
}

/** Optimistically patch cached data (e.g. insert a pending transaction). */
export function setQueryData<T>(key: string, updater: (prev: T | undefined) => T) {
  const e = getEntry<T>(key)
  commit<T>(key, { data: updater(e.snapshot.data), updatedAt: Date.now() })
}

export function getQueryData<T>(key: string): T | undefined {
  return (cache.get(key) as Entry<T> | undefined)?.snapshot.data
}

export function clearQueryCache() {
  const keys = Array.from(cache.keys())
  cache.clear()
  for (const k of keys) notify(k)
}

export interface QueryResult<T> extends QuerySnapshot<T> {
  refetch: () => Promise<void>
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
        set.delete(cb)
        getEntry<T>(k).subscribers -= 1
      }
    },
    [k],
  )
  const getSnapshot = useCallback(() => getEntry<T>(k).snapshot, [k])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const staleTime = opts.staleTime ?? 0
  useEffect(() => {
    if (!enabled) return
    const e = getEntry<T>(k)
    e.fetcher = () => fetcherRef.current()
    const stale = Date.now() - e.snapshot.updatedAt > staleTime
    if ((e.snapshot.data === undefined || stale) && !e.promise) void fetchKey<T>(k)
  }, [k, enabled, staleTime])

  const refetch = useCallback(() => fetchKey<T>(k, () => fetcherRef.current()), [k])

  return {
    data: snapshot.data,
    error: snapshot.error,
    loading: enabled && snapshot.data === undefined && snapshot.error === null,
    refetching: snapshot.refetching,
    updatedAt: snapshot.updatedAt,
    refetch,
  }
}

/** Mutation helper with loading + error state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const mutate = useCallback(async (...args: A): Promise<R> => {
    setPending(true)
    setError(null)
    try {
      return await fnRef.current(...args)
    } catch (err) {
      const e = toApiError(err)
      setError(e)
      throw e
    } finally {
      setPending(false)
    }
  }, [])
  return { mutate, pending, error, reset: useCallback(() => setError(null), []) }
}

export { toApiError }
