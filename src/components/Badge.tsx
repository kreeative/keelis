import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import styles from './Badge.module.css'

export type BadgeTone = 'accent' | 'neutral' | 'pos' | 'neg' | 'warn'
export type BadgeSize = 'xs' | 'sm'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  /** `true` uses the tone's own glyph; a node overrides it. xs badges are text-only. */
  icon?: ReactNode | true
  size?: BadgeSize
  children: ReactNode
}

/** The glyph that carries the tone when hue cannot: the kit gives each badge its own shape. */
const TONE_ICON: Record<BadgeTone, IconName> = {
  neutral: 'info',
  accent: 'star',
  pos: 'checkmark-filled',
  warn: 'warning',
  neg: 'circle-alert',
}

/** Pill badge: « Vérifié », « En attente », « APY 4,00 % » */
export function Badge({ tone = 'accent', icon, size = 'sm', className, children, ...rest }: BadgeProps) {
  const glyph = size === 'xs' ? null : icon === true ? <Icon name={TONE_ICON[tone]} /> : icon
  return (
    <span className={cn(styles.badge, styles[tone], size === 'xs' && styles.xs, className)} {...rest}>
      {glyph ? <span className={styles.icon}>{glyph}</span> : null}
      {children}
    </span>
  )
}
