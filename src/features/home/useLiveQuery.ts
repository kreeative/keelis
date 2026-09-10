/**
 * Workaround (local to features/home) for a store bug: `useQuery`'s getSnapshot returns
 * the same mutated Entry object, so `useSyncExternalStore` (Object.is) never re-renders a
 * screen after a fetch settles or after `setQueryData` patches the cache. Screens would sit
 * on their skeletons forever.
 *
 * This hook re-renders the caller:
 *  1. when the fetch started on mount settles (success or error),
 *  2. whenever the cached value for `key` changes identity (events, ticks, invalidations),
 *  3. after a manual `refetch()` (Réessayer).
 * If the store is fixed these renders are no-ops. Remove once src/store/query.ts notifies
 * with a fresh snapshot.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { getQueryData, type QueryResult } from '@/store'

const POLL_MS = 250

export function useLiveQuery<T>(query: QueryResult<T>, key: string): QueryResult<T> {
  const [, force] = useReducer((n: number) => n + 1, 0)
  const alive = useRef(true)
  const refetchRef = useRef(query.refetch)
  refetchRef.current = query.refetch

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 1. The mount-time fetch (started by useQuery's own effect) is de-duplicated by the store,
  //    so this returns the in-flight promise rather than starting a second request.
  useEffect(() => {
    void refetchRef.current().finally(() => alive.current && force())
  }, [key])

  // 2. Cache patches from API events / price ticks / invalidations.
  useEffect(() => {
    let last = getQueryData<T>(key)
    const id = setInterval(() => {
      const current = getQueryData<T>(key)
      if (current !== last) {
        last = current
        force()
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [key])

  // 3. Manual retry.
  const refetch = useCallback(() => refetchRef.current().finally(() => alive.current && force()), [])

  return { ...query, refetch }
}
