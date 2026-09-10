import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Spinner replaces the label; width is frozen so layout never jumps */
  loading?: boolean
  /** Stretch to container width */
  block?: boolean
  /** Leading icon */
  icon?: ReactNode
  /** Icon-only square button (needs aria-label) */
  iconOnly?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, icon, iconOnly = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(styles.btn, styles[variant], styles[size], block && styles.block, iconOnly && styles.iconOnly, loading && styles.loading, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.content} aria-hidden={loading || undefined}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children}
      </span>
      {loading ? (
        <span className={styles.spinner}>
          <Spinner size={size === 'lg' ? 22 : 18} />
        </span>
      ) : null}
    </button>
  )
})
