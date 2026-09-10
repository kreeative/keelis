import { cn } from '@/lib/cn'
import styles from './Avatar.module.css'

export interface AvatarProps {
  /** Text to derive a monogram from (name or ticker). */
  label: string
  /** Explicit monogram override (max 3 chars) */
  monogram?: string
  size?: number
  tone?: 'neutral' | 'accent' | 'ink'
  className?: string
}

function monogramOf(label: string): string {
  const parts = label.trim().split(/\s+/)
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

/** 40px circle with a monogram. Used for assets (ticker) and counterparties (initials). No brand logos. */
export function Avatar({ label, monogram, size = 40, tone = 'neutral', className }: AvatarProps) {
  const text = monogram ?? monogramOf(label)
  return (
    <span className={cn(styles.avatar, styles[tone], className)} style={{ width: size, height: size }} aria-hidden="true">
      <span className={styles.text} style={{ fontSize: text.length > 2 ? 'var(--fs-label)' : 'var(--fs-small)' }}>
        {text}
      </span>
    </span>
  )
}
