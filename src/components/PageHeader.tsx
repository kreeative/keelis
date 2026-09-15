import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  title?: ReactNode
  /** Small label above the title */
  eyebrow?: string
  /**
   * Back button target; -1 = history back. A function is a back that stays on the page —
   * `StepFlow` needs one, because inside a stepped flow « back » means the previous step
   * and leaving the route would throw away everything typed on the way here.
   */
  back?: string | -1 | (() => void)
  /** Close (X) instead of back arrow */
  close?: boolean
  actions?: ReactNode
  /** 'h1' (default) or 'h2' */
  level?: 'h1' | 'h2'
  className?: string
  /** Keep title visually hidden but present for screen readers */
  hideTitle?: boolean
}

export function PageHeader({ title, eyebrow, back, close = false, actions, level = 'h1', className, hideTitle = false }: PageHeaderProps) {
  const navigate = useNavigate()
  const Tag = level
  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.bar}>
        {back !== undefined ? (
          <Button variant="ghost" iconOnly aria-label={close ? 'Fermer' : 'Retour'} onClick={() => (typeof back === 'function' ? back() : back === -1 ? navigate(-1) : navigate(back))} className={styles.back}>
            <Icon name={close ? 'x' : 'arrow-left'} />
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.actions}>{actions}</div>
      </div>
      {title ? (
        <div className={cn(styles.titles, hideTitle && 'sr-only')}>
          {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
          <Tag className={level === 'h1' ? 't-h1' : 't-h2'}>{title}</Tag>
        </div>
      ) : null}
    </header>
  )
}
