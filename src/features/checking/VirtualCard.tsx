/**
 * The virtual card. Same ink on the same dark surface in both themes (--card-*),
 * no gradient, no chip graphic, no network logo.
 */
import type { Card } from '@/api/types'
import { Badge, Icon, Skeleton, Wordmark } from '@/components'
import { cn } from '@/lib/cn'
import styles from './VirtualCard.module.css'

export function expiryLabel(card: Card): string {
  return `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`
}

export function VirtualCard({ card, className }: { card: Card; className?: string }) {
  const frozen = card.frozen
  return (
    <div className={cn(styles.card, className)}>
      <div className={cn(styles.face, frozen && styles.faded)}>
        <div className={styles.top}>
          <Wordmark glyphOnly tone="paper" className={styles.mark} />
          <span className={styles.kind}>Virtuelle</span>
        </div>
        <div className={styles.bottom}>
          <p className={styles.number} aria-label={frozen ? 'Numéro masqué' : `Carte se terminant par ${card.last4.split('').join(' ')}`}>
            {frozen ? '•••• ••••' : `···· ${card.last4}`}
          </p>
          <div className={styles.foot}>
            <span className={styles.holder}>{card.holderName}</span>
            <span className={styles.expiry} aria-label={`Expiration ${expiryLabel(card)}`}>
              {expiryLabel(card)}
            </span>
          </div>
        </div>
      </div>
      {frozen ? (
        <div className={styles.frozenLayer}>
          <Badge tone="neutral" icon={<Icon name="snowflake" />} className={styles.frozenBadge}>
            Gelée
          </Badge>
        </div>
      ) : null}
    </div>
  )
}

export function VirtualCardSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton shape="card" width="100%" height="100%" />
    </div>
  )
}
