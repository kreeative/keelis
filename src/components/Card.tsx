import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import styles from './Card.module.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Navigate on click */
  to?: string
  padding?: 'md' | 'lg' | 'none'
}

/** Surface-alt block, 16px radius, no border, no shadow. */
export function Card({ children, to, padding = 'md', className, ...rest }: CardProps) {
  const cls = cn(styles.card, styles[padding], to && styles.interactive, className)
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}
