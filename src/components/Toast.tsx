import { createPortal } from 'react-dom'
import { useToast } from '@/store/toast'
import { cn } from '@/lib/cn'
import styles from './Toast.module.css'

/**
 * Bottom toast, 1 line, 3 s. Mounted once at the app root and portalled to <body>, so it
 * works on public pages too. It sits below sheets (--z-toast < --z-sheet) and never covers
 * a dialog's buttons.
 */
export function ToastViewport() {
  const { current } = useToast()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      {current ? (
        <div key={current.id} className={cn(styles.toast, current.tone === 'error' && styles.error)} role="status">
          {current.message}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
