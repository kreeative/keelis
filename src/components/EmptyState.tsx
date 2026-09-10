import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** One sentence */
  message: string
  /** One button */
  action?: ReactNode
  /** Monospace caption describing the visual to be supplied */
  placeholderCaption?: string
  className?: string
  compact?: boolean
}

/** One sentence, one button. The visual is a hairline-striped placeholder (no illustration drawn). */
export function EmptyState({ message, action, placeholderCaption, className, compact = false }: EmptyStateProps) {
  return (
    <div className={cn(styles.empty, compact && styles.compact, className)}>
      {!compact ? (
        <figure className={styles.figure}>
          <svg className={styles.placeholder} viewBox="0 0 160 100" role="img" aria-label={placeholderCaption ?? 'Espace réservé pour un visuel'}>
            <defs>
              <pattern id="kaalis-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0.5" y="0.5" width="159" height="99" rx="12" fill="url(#kaalis-stripes)" stroke="currentColor" strokeWidth="1" />
          </svg>
          {placeholderCaption ? <figcaption className={styles.caption}>{placeholderCaption}</figcaption> : null}
        </figure>
      ) : null}
      <p className={styles.message}>{message}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
