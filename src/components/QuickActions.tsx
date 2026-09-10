import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import styles from './QuickActions.module.css'

export interface QuickAction {
  label: string
  icon: ReactNode
  to?: string
  onClick?: () => void
  disabled?: boolean
}

/** Row of round icon buttons with a label under each. */
export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  return (
    <div className={cn(styles.row, className)} role="group" aria-label="Actions rapides">
      {actions.map((a) => {
        const inner = (
          <>
            <span className={styles.circle}>{a.icon}</span>
            <span className={styles.label}>{a.label}</span>
          </>
        )
        return a.to && !a.disabled ? (
          <Link key={a.label} to={a.to} className={styles.action}>
            {inner}
          </Link>
        ) : (
          <button key={a.label} type="button" className={styles.action} onClick={a.onClick} disabled={a.disabled}>
            {inner}
          </button>
        )
      })}
    </div>
  )
}
