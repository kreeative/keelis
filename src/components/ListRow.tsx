/**
 * 64px row: leading 40px avatar/icon + title + subtitle + right-aligned value (+ delta).
 * Rows are separated by a 1px line between them (never around).
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import styles from './ListRow.module.css'

export interface ListRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'value'> {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  value?: ReactNode
  /** Small line under the value (delta, status) */
  valueSub?: ReactNode
  /** Render as a router link */
  to?: string
  /** Show chevron on the right */
  chevron?: boolean
  /** Trailing custom node (e.g. Switch) — replaces chevron */
  trailing?: ReactNode
  /** Non-interactive row */
  static?: boolean
  muted?: boolean
  /** Let the title and subtitle wrap instead of truncating (long names, document titles) */
  wrap?: boolean
}

export const ListRow = forwardRef<HTMLButtonElement, ListRowProps>(function ListRow(
  { leading, title, subtitle, value, valueSub, to, chevron = false, trailing, static: isStatic = false, muted = false, wrap = false, className, onClick, ...rest },
  ref,
) {
  const body = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={cn(styles.main, wrap && styles.wrap)}>
        <span className={cn(styles.title, muted && styles.muted)}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      {value !== undefined || valueSub !== undefined ? (
        <span className={styles.value}>
          {value !== undefined ? <span className={cn(styles.valueMain, muted && styles.muted)}>{value}</span> : null}
          {valueSub !== undefined ? <span className={styles.valueSub}>{valueSub}</span> : null}
        </span>
      ) : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : chevron ? <Icon name="chevron-right" className={styles.chevron} /> : null}
    </>
  )
  const cls = cn(styles.row, (to || onClick) && !isStatic && styles.interactive, className)
  if (to && !isStatic) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  }
  if (isStatic || !onClick) {
    return <div className={cls}>{body}</div>
  }
  return (
    <button ref={ref} type="button" className={cls} onClick={onClick} {...rest}>
      {body}
    </button>
  )
})

/** Container that draws 1px separators between rows only. */
export function List({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn(styles.list, className)} role={label ? 'list' : undefined} aria-label={label}>
      {children}
    </div>
  )
}
