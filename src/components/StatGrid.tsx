/**
 * The kit's Stats block, with both of its shapes: on a narrow screen a list of
 * label-left / value-right rows separated by hairlines; from 768px a multi-column grid
 * with the label above the value and no rules at all. Same markup, one breakpoint.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import styles from './StatGrid.module.css'

export interface Stat {
  label: ReactNode
  value: ReactNode
}

export function StatGrid({ stats, label, className }: { stats: Stat[]; label?: string; className?: string }) {
  return (
    <dl className={cn(styles.grid, className)} aria-label={label}>
      {stats.map((s, i) => (
        <div key={i} className={styles.stat}>
          <dt className={styles.label}>{s.label}</dt>
          <dd className={cn(styles.value, 'num')}>{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}
