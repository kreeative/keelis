import { Avatar } from './Avatar'
import { AssetIcon } from './AssetIcon'
import { cn } from '@/lib/cn'
import styles from './AvatarStack.module.css'

export interface AvatarStackProps {
  /** Labels, in display order. Beyond `max` the rest are summarised.
      Only the first letter is drawn: at this size, overlapped, more is unreadable. */
  items: string[]
  max?: number
  size?: number
  className?: string
  /** Describes the whole stack; the individual marks stay decorative. */
  label: string
  /** Draw each item as its asset mark rather than a monogram. */
  assets?: boolean
}

/** Overlapping monograms — a compact way to stand for a set of holdings. */
export function AvatarStack({ items, max = 4, size = 28, className, label, assets = false }: AvatarStackProps) {
  const shown = items.slice(0, max)
  const extra = items.length - shown.length
  return (
    <span className={cn(styles.stack, className)} role="img" aria-label={label} style={{ '--stack-size': `${size}px` } as React.CSSProperties}>
      {shown.map((m, i) => (
        <span key={m + i} className={styles.item} style={{ width: size, height: size }}>
          {assets ? <AssetIcon symbol={m} size="sm" className={styles.mark} /> : <Avatar label={m} monogram={m.slice(0, 1)} size={size} />}
        </span>
      ))}
      {extra > 0 ? (
        <span className={styles.item}>
          <Avatar label={`+${extra}`} monogram={`+${extra}`} size={size} tone="ink" />
        </span>
      ) : null}
    </span>
  )
}
