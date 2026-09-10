import styles from './Spinner.module.css'
import { cn } from '@/lib/cn'

export function Spinner({ size = 20, className, label = 'Chargement' }: { size?: number; className?: string; label?: string }) {
  return (
    <span className={cn(styles.spinner, className)} style={{ width: size, height: size }} role="status" aria-label={label}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="42 18" />
      </svg>
    </span>
  )
}
