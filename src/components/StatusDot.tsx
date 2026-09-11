import { cn } from '@/lib/cn'
import styles from './StatusDot.module.css'

export interface StatusDotProps {
  /** Sits at the top-right corner of a positioned parent, just outside its box. */
  corner?: boolean
  className?: string
}

/**
 * 8px unread marker with a 2px ring of the page surface, so it stays legible over an
 * icon or an avatar. Geometry taken from the reference kit's "icon with notification".
 * Decorative: the count belongs in the control's accessible name.
 */
export function StatusDot({ corner = false, className }: StatusDotProps) {
  return <span className={cn(styles.dot, corner && styles.corner, className)} aria-hidden="true" />
}
