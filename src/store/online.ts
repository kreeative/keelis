import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const get = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

/** true when the browser reports connectivity */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, get, () => true)
}
