/**
 * Row whose trailing element is a control (Switch, SegmentedControl) instead of a chevron.
 * `wide` controls drop under the title on narrow screens so nothing is ever squeezed.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import styles from './SettingRow.module.css'

export interface SettingRowProps {
  /** Leading circle icon, aligned with the ListRow rows around it. */
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  control: ReactNode
  /** The control needs the full width below ~600px (segmented controls). */
  wide?: boolean
  className?: string
}

export function SettingRow({ leading, title, subtitle, control, wide = false, className }: SettingRowProps) {
  return (
    <div className={cn(styles.row, className)}>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      <span className={cn(styles.trail, wide && styles.wide)}>{control}</span>
    </div>
  )
}
