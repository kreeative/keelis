import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/store/toast'
import { cn } from '@/lib/cn'
import { EXIT_MS, reducedMotion } from '@/lib/motion'
import styles from './Toast.module.css'

/**
 * Bottom toast, 1 line, 3 s. Mounted once at the app root and portalled to <body>, so it
 * works on public pages too. It sits below sheets (--z-toast < --z-sheet) and never covers
 * a dialog's buttons.
 *
 * It stays mounted through its exit. The store drops `current` to null the moment the
 * timer runs out, which used to take the toast off screen between two frames — an arrival
 * with a spring on it and no departure at all. `leaving` holds the last one for exactly
 * `--dur-exit` and plays the arrival backwards.
 */
export function ToastViewport() {
  const { current } = useToast()
  const [leaving, setLeaving] = useState<typeof current>(null)
  const last = useRef<typeof current>(null)

  useEffect(() => {
    if (current) {
      last.current = current
      setLeaving(null)
      return
    }
    if (!last.current) return
    if (reducedMotion()) {
      last.current = null
      return
    }
    setLeaving(last.current)
    last.current = null
    const t = setTimeout(() => setLeaving(null), EXIT_MS)
    return () => clearTimeout(t)
  }, [current])

  if (typeof document === 'undefined') return null
  const shown = current ?? leaving
  return createPortal(
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      {shown ? (
        <div
          key={shown.id}
          className={cn(styles.toast, shown.tone === 'error' && styles.error, !current && styles.leaving)}
          role="status"
          /* On its way out it is no longer news: announcing it again as it leaves would read
             the same message twice. */
          aria-hidden={!current ? true : undefined}
        >
          {shown.message}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
