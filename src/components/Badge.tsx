import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import styles from './Badge.module.css'

export type BadgeTone = 'accent' | 'neutral' | 'pos' | 'neg' | 'warn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
}

/** Pill badge: « Vérifié », « En attente », « APY 4,00 % » */
export function Badge({ tone = 'accent', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], className)} {...rest}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {children}
    </span>
  )
}
