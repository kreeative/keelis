/**
 * Explicit success state after a money movement: what happened, status, next step.
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon } from '@/components'
import styles from './SuccessScreen.module.css'

export interface SuccessScreenProps {
  title: string
  /** The hero amount / quantity acquired */
  hero: ReactNode
  caption?: ReactNode
  /** Status badge text, e.g. "En attente · quelques minutes" */
  status?: string
  /** Detail lines */
  details?: Array<{ label: ReactNode; value: ReactNode }>
  primaryLabel?: string
  primaryTo?: string
  onPrimary?: () => void
  secondaryLabel?: string
  secondaryTo?: string
  onSecondary?: () => void
}

export function SuccessScreen({ title, hero, caption, status, details, primaryLabel = 'Terminé', primaryTo = '/', onPrimary, secondaryLabel, secondaryTo, onSecondary }: SuccessScreenProps) {
  const navigate = useNavigate()
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <span className={styles.mark}>
        <Icon name="check" size={28} />
      </span>
      <h1 className="t-h2">{title}</h1>
      <div className={styles.hero}>{hero}</div>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
      {status ? <Badge tone="neutral">{status}</Badge> : null}
      {details?.length ? (
        <dl className={styles.details}>
          {details.map((d, i) => (
            <div key={i} className={styles.detail}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={styles.actions}>
        <Button size="lg" block onClick={onPrimary ?? (() => navigate(primaryTo))}>
          {primaryLabel}
        </Button>
        {secondaryLabel ? (
          <Button variant="ghost" block onClick={onSecondary ?? (() => navigate(secondaryTo ?? '/'))}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
