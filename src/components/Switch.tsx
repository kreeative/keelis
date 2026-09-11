import { cn } from '@/lib/cn'
import styles from './Switch.module.css'

export interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  loading?: boolean
  id?: string
  className?: string
}

/**
 * Accessible toggle (role=switch), 44px tap target.
 * The knob carries a checkmark when on, so the state never depends on colour — which it
 * cannot, since the palette is monochrome.
 */
export function Switch({ checked, onChange, label, disabled, loading, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(styles.wrap, className)}
      onClick={() => onChange(!checked)}
    >
      <span className={cn(styles.track, checked && styles.on)}>
        <span className={styles.thumb}>
          <svg className={styles.check} viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </button>
  )
}
