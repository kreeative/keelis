/**
 * Épargne-area hooks. Data comes from the shared store; this only adds the
 * media-query helper the chart height needs (Chart takes a numeric height,
 * so the breakpoint cannot live in CSS).
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
