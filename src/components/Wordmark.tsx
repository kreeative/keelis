import styles from './Wordmark.module.css'
import { cn } from '@/lib/cn'

/** Kaalis wordmark: a simple K glyph + name. Inherits currentColor. */
export function Wordmark({ size = 'md', className, glyphOnly = false }: { size?: 'sm' | 'md' | 'lg'; className?: string; glyphOnly?: boolean }) {
  return (
    <span className={cn(styles.mark, styles[size], className)} aria-label="Kaalis" role="img">
      <svg viewBox="0 0 24 24" className={styles.glyph} aria-hidden="true">
        <path d="M7 4v16M7 12l8-8M7 12l9 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!glyphOnly ? <span className={styles.name}>Kaalis</span> : null}
    </span>
  )
}
