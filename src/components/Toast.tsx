import { useToast } from '@/store/toast'
import { cn } from '@/lib/cn'
import styles from './Toast.module.css'

/** Bottom toast, 1 line, 3 s. Mount once in the shell. */
export function ToastViewport() {
  const { current } = useToast()
  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      {current ? (
        <div key={current.id} className={cn(styles.toast, current.tone === 'error' && styles.error)} role="status">
          {current.message}
        </div>
      ) : null}
    </div>
  )
}
