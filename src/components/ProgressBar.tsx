import { cn } from '@/lib/cn'
import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  /** 0..1 */
  value: number
  label: string
  /** 'thin' = 2px hairline (goals, onboarding). */
  size?: 'thin' | 'regular'
  tone?: 'accent' | 'ink'
  className?: string
}

/** One fine line, no ring. */
export function ProgressBar({ value, label, size = 'thin', tone = 'accent', className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div className={cn(styles.track, styles[size], className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <div className={cn(styles.fill, styles[tone])} style={{ transform: `scaleX(${pct})` }} />
    </div>
  )
}
