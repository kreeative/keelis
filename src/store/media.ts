/**
 * Viewport queries, shared. Two named breakpoints matter beyond the CSS:
 * 768px is our layout breakpoint (the rail appears, columns split), and 1024px is the
 * kit's — the width at which it says to stop stepping through a task and group it into
 * one form, because a keyboard and a mouse make that faster than a wizard.
 */
import { useCallback, useSyncExternalStore } from 'react'

/** true when the media query matches (SSR / jsdom safe). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia?.(query)
      mq?.addEventListener?.('change', cb)
      return () => mq?.removeEventListener?.('change', cb)
    },
    [query],
  )
  const getSnapshot = useCallback(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** ≥ 768px — the rail layout and split columns. */
export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

/** ≥ 1024px — the kit's « large », where a stepped task becomes one grouped form. */
export function useLargeScreen(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
