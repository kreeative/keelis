/**
 * The virtual card. Same ink on the same dark surface in both themes (--card-*), no chip
 * graphic, no network logo.
 *
 * **Its face is artwork now, under the type.** The owner put a Revolut metal card beside a
 * cowrie print and a sheet of Adinkra symbols and asked for the same: a card that is an
 * object with something engraved on it, in the app's own iconography. The face is the
 * `card` photo slot — a brushed brown metal rendered on the owner's Higgsfield account,
 * the cowrie and four Adinkra symbols etched in gold on the right half, the left third and
 * the foot left plain because that is where the type sits. The gradient stays underneath
 * as the ground: with the slot switched off the card is exactly what it was.
 *
 * There is no « Virtuelle » label on it, and no K disc: the owner asked for the name
 * on the card instead — the owner's own wordmark, engraved in the symbols' gold — the way
 * a metal card carries its bank's name and nothing else. The symbols are the
 * render's own: the owner liked their etched texture, and what they wanted changed was the
 * size — the cowrie was bigger than the others, and now the five are one size.
 */
import type { Card } from '@/api/types'
import { Badge, Icon, Photo, Skeleton, Wordmark } from '@/components'
import { cn } from '@/lib/cn'
import styles from './VirtualCard.module.css'

export function expiryLabel(card: Card): string {
  return `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`
}

export function VirtualCard({ card, className }: { card: Card; className?: string }) {
  const frozen = card.frozen
  return (
    <div className={cn(styles.card, className)}>
      {/* The card is 400px at most, so the 800px file serves a 2× phone; `sizes` says so,
          or the browser fetches the 1600px file for a card that never grows past 400. */}
      {/* Frozen dims the engraving with the type: a face that stayed lit under greyed
          figures read as a card with a fault, not a card put on hold. */}
      <Photo name="card" className={cn(styles.art, frozen && styles.faded)} sizes="(min-width: 432px) 400px, calc(100vw - 32px)" />
      <div className={cn(styles.face, frozen && styles.faded)}>
        <div className={styles.top}>
          <Wordmark className={styles.name} />
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
