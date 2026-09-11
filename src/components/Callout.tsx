/**
 * A contextual heads-up, placed in the flow before the action rather than after it —
 * the kit's « Reinforce sense of security »: tell someone what a withdrawal means while
 * they can still change their mind, not once it is done.
 *
 * `note` is the quiet inline form (a line under a field); `panel` is the boxed form the
 * kit uses for a consequence worth stopping on. With no hue in the palette, the icon and
 * the box carry the weight the colour would have.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import styles from './Callout.module.css'

export interface CalloutProps {
  title?: ReactNode
  children: ReactNode
  /** Defaults to the alert triangle; pass another glyph when the note is not a warning. */
  icon?: IconName
  variant?: 'note' | 'panel'
  className?: string
}

export function Callout({ title, children, icon = 'warning', variant = 'note', className }: CalloutProps) {
  return (
    <div className={cn(styles.callout, styles[variant], className)} role="note">
      <Icon name={icon} size={18} className={styles.icon} />
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <div className={styles.text}>{children}</div>
      </div>
    </div>
  )
}
