/**
 * Section heading: an uppercase label on the left, an optional action on the right.
 * The `circle` variant puts the action in a round icon button — the treatment the
 * reference kit uses beside a section label. `link` keeps a labelled text link.
 */
import type { ElementType } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import styles from './SectionHeader.module.css'

export interface SectionAction {
  /** Always required: it labels the control for assistive technology. */
  label: string
  to?: string
  onClick?: () => void
  icon?: IconName
  variant?: 'link' | 'circle'
  disabled?: boolean
}

export interface SectionHeaderProps {
  title: string
  /** Heading level. Defaults to h2. */
  as?: ElementType
  action?: SectionAction
  className?: string
}

function ActionBody({ action }: { action: SectionAction }) {
  const circle = action.variant === 'circle'
  return (
    <>
      {!circle ? <span>{action.label}</span> : null}
      {action.icon ? <Icon name={action.icon} size={circle ? 20 : 16} /> : null}
    </>
  )
}

export function SectionHeader({ title, as: Tag = 'h2', action, className }: SectionHeaderProps) {
  const circle = action?.variant === 'circle'
  const cls = cn(styles.action, circle && styles.circle)
  return (
    <div className={cn(styles.head, className)}>
      <Tag className={styles.title}>{title}</Tag>
      {action ? (
        action.to && !action.disabled ? (
          <Link to={action.to} className={cls} aria-label={circle ? action.label : undefined}>
            <ActionBody action={action} />
          </Link>
        ) : (
          <button type="button" className={cls} onClick={action.onClick} disabled={action.disabled} aria-label={circle ? action.label : undefined}>
            <ActionBody action={action} />
          </button>
        )
      ) : null}
    </div>
  )
}
