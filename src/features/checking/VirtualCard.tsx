/**
 * The virtual card, drawn as the object it stands for: an ISO/IEC 7810 ID-1 card — 85.60 ×
 * 53.98 mm with 3.18 mm corners — with a recto and a verso. Same ink on the same dark surface
 * in both themes (--card-*), no network logo.
 *
 * **Everything on it is placed in proportions of that card.** The stylesheet works in `cqw`
 * of the card's own width, so the whole face scales as one piece at every width the screen
 * gives it instead of keeping 24px margins on a card that got smaller. The recto's positions
 * are the owner's: they composed the card at 400 × 252 in Figma and said « use the
 * measurements I use in the front card », so the wordmark, the chip and the name sit where
 * they put them, as fractions of the width — and their chip landed on the ISO/IEC 7816-2
 * contact position within a few pixels, which is why it reads as a real card. The verso's
 * stripe is where ISO/IEC 7811 puts the tape.
 *
 * **The recto is the owner's own composition.** They put a Revolut metal card beside a cowrie
 * print and a sheet of Adinkra symbols and asked for the same; five renders of a wedge of six
 * different marks followed; then they opened the Figma file of the card, moved things where
 * they wanted them and sent a screenshot: « look what I did, this is what I mean ». The face
 * is the `card` photo slot — the brushed brown metal rendered on their Higgsfield account,
 * with **one mark, the cowrie, six times** at one size, each tilted its own way, clustered
 * toward the top-right corner exactly where they put them (composited in
 * `brand-src/card/card-face.png` from the plain plate and the cut-out cowrie the Figma file
 * carries). The left two thirds and the foot stay plain because that is where the chip and
 * the type sit, and the foot carries **the holder's name alone**, as their card does — the
 * last four digits went to the verso with the rest of the number. The gradient stays
 * underneath as the ground: with the slot switched off the card is exactly what it was.
 *
 * There is no « Virtuelle » label on it, and no K disc: the name on the card is the owner's own
 * wordmark, engraved in the symbols' gold, the way a metal card carries its bank's name and
 * nothing else — aligned on the chip's left edge and as far from the top as from the side, the
 * owner having found it too near the edge at the old 24px. The chip is a gold plate set into
 * the metal, in the same gold.
 *
 * **The verso is where the numbers are**, as on a card whose front is kept clean: the stripe,
 * the issuer's small print under it with the contactless arcs beside it, then
 * the full number, the expiry and the security code — and neither the wordmark nor the
 * holder's name, which are on the front, and the owner does not want twice (« the logo is
 * already on the front, don't put it on the back », « the name also is already on the
 * front »). The recto also carries the network's mark at the foot's right end, where every
 * real card has it — typeset, until the owner supplies the licensed artwork. Turning the card over *is* asking for the
 * numbers — `CardPanel` owns that, so the rules stay in one place: an explicit request, hidden
 * again after 30 s, never on a frozen card. The side facing away is `inert` and hidden from
 * assistive technology, so nothing reads or tabs into the back of a card nobody can see.
 */
import type { Card, CardSecrets } from '@/api/types'
import { Badge, Icon, Photo, Skeleton, Wordmark } from '@/components'
import { cn } from '@/lib/cn'
import styles from './VirtualCard.module.css'

export function expiryLabel(card: Card): string {
  return `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`
}

/** The number the way a card prints it: four groups of four. */
export function groupPan(pan: string): string {
  return pan
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

/* The 800px file serves a 2× phone, and the card never grows past 400px; `sizes` says so, or
   the browser fetches the 1600px file for a card that never needs it. */
const ART_SIZES = '(min-width: 432px) 400px, calc(100vw - 32px)'

/**
 * The contact plate's cuts, in the plate's own proportions (12 × 10 mm → 120 × 100): three
 * contacts down each side, the island in the middle, and the two cuts that meet it top and
 * bottom — the pattern a person recognises as a chip before they read anything else.
 */
function ChipCuts() {
  return (
    <svg className={styles.cuts} viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <rect x="38" y="22" width="44" height="56" rx="10" />
      <path d="M0 36H38M0 64H38M82 36H120M82 64H120M60 0V22M60 78V100" />
    </svg>
  )
}

/**
 * The issuer's small print, as the back of every real card carries it: who issued the card,
 * on whose network, whose property it stays, and where to turn for help. It is one constant
 * so it is one edit — and it has to be true before a real card ships: the app is agréée by no
 * authority today (/entreprise says so), so this line is the card's copy as the owner asked
 * for it, not a licence the codebase can point at. Help is the app's own Aide, not a phone
 * number nobody answers. Three lines at the 12px floor on a phone's card: the first draft
 * said the same in six and ran into the number.
 */
const VERSO_LEGEND = 'Émise par Keewal Meere sous licence de Visa International. Reste la propriété de l’émetteur. Assistance : Profil › Aide.'

/**
 * The contactless indicator — EMVCo's four arcs, the mark every card with an antenna carries;
 * the owner named it « the Wi-Fi symbol » and asked for it on the back. Stroked in the
 * engraving's gold, drawn in one viewBox so it scales with the card.
 */
function Contactless() {
  return (
    <svg className={styles.contactless} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M31.5 40.4A15 15 0 0 1 31.5 59.6M43 30.7A30 30 0 0 1 43 69.3M54.5 21.1A45 45 0 0 1 54.5 78.9M66 11.4A60 60 0 0 1 66 88.6" />
    </svg>
  )
}

export interface VirtualCardProps {
  card: Card
  /** Show the verso — the side with the numbers. Ignored while the card is frozen. */
  turned?: boolean
  /** The numbers, once they have arrived; until then the verso masks what is secret. */
  secrets?: CardSecrets | null
  /**
   * Turn the card by touching it. A pointer shortcut only: the panel's « Afficher les
   * numéros » button is the way in for a keyboard and a screen reader, so the card itself is
   * not a second tab stop saying the same thing.
   */
  onTurn?: () => void
  className?: string
}

export function VirtualCard({ card, turned = false, secrets = null, onTurn, className }: VirtualCardProps) {
  const frozen = card.frozen
  const back = turned && !frozen
  /* The numbers are written only while the verso faces up — not merely hidden on a side that
     faces away — so a frozen card cannot carry them, and « Masquer » masks them the moment it
     is pressed, while the card is still turning away. */
  const numbers = back ? secrets : null
  return (
    <div className={cn(styles.card, back && styles.turned, className)}>
      <div className={styles.flipper}>
        <div className={cn(styles.side, styles.front)} aria-hidden={back || undefined} inert={back}>
          {/* Frozen dims the engraving with the type: a face that stayed lit under greyed
              figures read as a card with a fault, not a card put on hold. */}
          <Photo name="card" className={cn(styles.art, frozen && styles.faded)} sizes={ART_SIZES} />
          <div className={cn(styles.face, frozen && styles.faded)}>
            <Wordmark className={styles.name} />
            <span className={styles.chip} aria-hidden="true">
              <ChipCuts />
            </span>
            <span className={styles.holder}>{card.holderName}</span>
            <span className={styles.network}>VISA</span>
          </div>
        </div>
        <div className={cn(styles.side, styles.back)} role="group" aria-label="Verso de la carte" aria-hidden={!back || undefined} inert={!back}>
          {/* The same metal on the back, from the plain half of the same picture — the same
              file and the same `sizes`, so it costs no second download. Hidden from assistive
              technology: the slot's description is of the engraved face, not of this side. */}
          <div className={styles.backArt} aria-hidden="true">
            <Photo name="card" className={styles.art} sizes={ART_SIZES} />
          </div>
          <span className={styles.stripe} aria-hidden="true" />
          <p className={styles.legend}>{VERSO_LEGEND}</p>
          <Contactless />
          <div className={styles.details}>
            <p className={styles.pan}>
              <span className="sr-only">Numéro : </span>
              {numbers ? groupPan(numbers.pan) : `•••• •••• •••• ${card.last4}`}
            </p>
            <dl className={styles.meta}>
              <div className={styles.pair}>
                <dt className={styles.key}>Expire fin</dt>
                <dd className={styles.value}>{expiryLabel(card)}</dd>
              </div>
              <div className={styles.pair}>
                <dt className={styles.key}>CVV</dt>
                <dd className={styles.value}>{numbers ? numbers.cvv : '•••'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      {onTurn && !frozen ? <div className={styles.touch} onClick={onTurn} aria-hidden="true" /> : null}
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
      <Skeleton shape="card" width="100%" height="100%" className={styles.skeletonFace} />
    </div>
  )
}
