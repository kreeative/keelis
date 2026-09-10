import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  /** 'text' = rounded 10px line, 'circle' = avatar, 'card' = 16px radius block */
  shape?: 'text' | 'circle' | 'card' | 'pill'
  className?: string
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 16, shape = 'text', className, style }: SkeletonProps) {
  return <span className={cn(styles.skeleton, styles[shape], className)} style={{ width, height, ...style }} aria-hidden="true" />
}

/** Skeleton for a 64px ListRow: avatar + two lines + value */
export function SkeletonRow({ count = 1 }: { count?: number }) {
  return (
    <div className={styles.rows} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className={styles.row} key={i}>
          <Skeleton shape="circle" width={40} height={40} />
          <div className={styles.lines}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={12} />
          </div>
          <Skeleton width={72} height={14} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a display-size amount */
export function SkeletonAmount() {
  return (
    <div className={styles.amount} aria-hidden="true">
      <Skeleton width="60%" height="var(--fs-display)" />
      <Skeleton width="30%" height={14} />
    </div>
  )
}
