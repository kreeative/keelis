/**
 * One question per screen: eyebrow, dominant question, the inputs, then a single
 * primary action pinned to the bottom of the column. Submitting with Enter works
 * everywhere because the shell is a real <form>.
 */
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components'
import { cn } from '@/lib/cn'
import styles from './StepShell.module.css'

export interface StepShellProps {
  eyebrow: string
  title: string
  /** One sober sentence under the question */
  description?: ReactNode
  children?: ReactNode
  submitLabel?: string
  submitDisabled?: boolean
  submitting?: boolean
  onSubmit?: () => void
  /** Secondary action under the primary button */
  footer?: ReactNode
  /** Hide the primary button (steps that advance on their own, e.g. the NIP) */
  hideSubmit?: boolean
  className?: string
}

export function StepShell({ eyebrow, title, description, children, submitLabel = 'Continuer', submitDisabled = false, submitting = false, onSubmit, footer, hideSubmit = false, className }: StepShellProps) {
  const handle = (e: FormEvent) => {
    e.preventDefault()
    if (!submitDisabled && !submitting) onSubmit?.()
  }
  return (
    <form className={cn(styles.step, className)} onSubmit={handle} noValidate>
      <div className={styles.head}>
        <p className="t-label">{eyebrow}</p>
        <h1 className="t-h1">{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>
        {hideSubmit ? null : (
          <Button type="submit" size="lg" block disabled={submitDisabled} loading={submitting}>
            {submitLabel}
          </Button>
        )}
        {footer}
      </div>
    </form>
  )
}
