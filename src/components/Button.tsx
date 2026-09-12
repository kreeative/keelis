import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
  /**
   * Navigate on activation: renders a real <a> rather than a button, the way `Card` already
   * does. A destination is a link — it has to survive a middle-click, a long-press and a
   * "copy link address", which an onClick handler on a <button> silently does not.
   */
  to?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, icon, iconOnly = false, to, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = cn(styles.btn, styles[variant], styles[size], block && styles.block, iconOnly && styles.iconOnly, loading && styles.loading, className)
  const content = (
    <>
      <span className={styles.content} aria-hidden={loading || undefined}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children}
      </span>
      {loading ? (
        <span className={styles.spinner}>
          <Spinner size={size === 'lg' ? 22 : 18} />
        </span>
      ) : null}
    </>
  )

  if (to && !disabled && !loading) {
    const { 'aria-label': ariaLabel } = rest
    return (
      <Link to={to} className={cls} aria-label={ariaLabel}>
        {content}
      </Link>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  )
})
