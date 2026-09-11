import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import styles from './Card.module.css'

export type CardElevation = 'flat' | 1 | 2 | 3
export type CardMaterial = 'glass' | 'glass-strong' | 'solid'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Navigate on click (renders an <a>) */
  to?: string
  /** Act on click (renders a <button>) */
  onPress?: () => void
  padding?: 'md' | 'lg' | 'none'
  /** Layered depth. 2 is the default card lift. */
  elevation?: CardElevation
  /** Surface material. Glass needs an ambient ground behind it (body::before). */
  material?: CardMaterial
  /** Tactile lift on hover/press. Implied by `to`/`onPress`. */
  interactive?: boolean
  /** Accessible label when the card is a button/link with no text label */
  label?: string
}

/**
 * Elevated glass card: translucent surface, heavy backdrop blur, a hairline top
 * highlight, and a three-layer shadow stack (ambient contact, direct drop, deep lift).
 * Interactive cards lift 2px and scale 1% on hover, and settle on press.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, to, onPress, padding = 'md', elevation = 2, material = 'glass', interactive, className, label, ...rest },
  ref,
) {
  const isInteractive = interactive ?? (!!to || !!onPress)
  const cls = cn(
    styles.card,
    material !== 'solid' && 'glass',
    material === 'glass-strong' && 'glass-strong',
    material === 'solid' && styles.solid,
    elevation !== 'flat' && `elev-${elevation}`,
    styles[padding],
    isInteractive && styles.interactive,
    className,
  )
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={label}>
        {children}
      </Link>
    )
  }
  if (onPress) {
    return (
      <button type="button" className={cn(cls, styles.asButton)} onClick={onPress} aria-label={label}>
        {children}
      </button>
    )
  }
  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  )
})
