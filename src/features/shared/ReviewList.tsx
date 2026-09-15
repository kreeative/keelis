/**
 * The aperçu step, drawn from the *same* lines the confirmation sheet will show.
 *
 * A flow now says what it is about to do twice — once on the aperçu screen and once in the
 * sheet over it — and the one thing those two must never do is disagree. This app has been
 * bitten by exactly that before: the trade screen's preview promised « ≈ 1.6976 SNTS » for
 * a total the server then filled as one share. So the lines are built once, by the flow,
 * and both surfaces render the array. A line added to one is a line in the other.
 *
 * The hero leads, because splitting the keypad onto its own screen took away the only
 * place the amount was visible — a summary you confirm without the sum on it is worse than
 * no summary at all.
 */
import type { ReactNode } from 'react'
import { List, ListRow } from '@/components'
import type { SummaryLine } from './ConfirmSheet'
import styles from './ReviewList.module.css'

export interface ReviewListProps {
  hero?: ReactNode
  heroCaption?: ReactNode
  lines: SummaryLine[]
  /** Small print under the lines — a spread disclosure, a delay, a « demonstration » note. */
  note?: ReactNode
}

export function ReviewList({ hero, heroCaption, lines, note }: ReviewListProps) {
  return (
    <div className={styles.root}>
      {hero ? (
        <div className={styles.hero}>
          <div className={styles.heroValue}>{hero}</div>
          {heroCaption ? <p className={styles.heroCaption}>{heroCaption}</p> : null}
        </div>
      ) : null}
      <List>
        {lines.map((l, i) => (
          <ListRow key={i} static title={l.label} subtitle={l.hint} value={l.value} />
        ))}
      </List>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  )
}
