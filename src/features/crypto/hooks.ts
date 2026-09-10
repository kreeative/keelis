import { useSyncExternalStore } from 'react'

function subscribeMq(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia?.(query)
    mq?.addEventListener?.('change', cb)
    return () => mq?.removeEventListener?.('change', cb)
  }
}

/** true when the media query matches (SSR/jsdom safe). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeMq(query),
    () => (typeof window !== 'undefined' && !!window.matchMedia?.(query).matches),
    () => false,
  )
}

/** ≥ 768px — desktop rail layout (mirrors the CSS breakpoint in tokens.css). */
export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
