/**
 * The short explanations that turn a listing into something somebody can act on.
 *
 * The roadmap asks for « pédagogie contextuelle » beside the market, and the reason is
 * specific to this product: most people buying their first share on the BRVM have never
 * bought one anywhere, and the words on the screen — introduction en bourse, cours, écart —
 * are the part that stops them, not the buttons.
 *
 * Each explanation is four or five sentences and ends by saying what to *do*, including
 * « rien pour l'instant » when that is the honest answer. A card that says « Comprendre une
 * IPO » and opens nothing is worse than no card, which is what the button did before this
 * existed: it had neither an `onClick` nor a `to`.
 *
 * The content lives in `features/learn/lessons.ts` now, because the Learn tab lists the same
 * lessons: one text, opened from two places, so the market cannot teach something Learn
 * does not know.
 */
import { Button, Sheet } from '@/components'
import { LESSONS, type LearnTopic } from '@/features/learn/lessons'
import styles from './LearnSheet.module.css'

export type { LearnTopic }

export function LearnSheet({ topic, open, onClose }: { topic: LearnTopic; open: boolean; onClose: () => void }) {
  const explanation = LESSONS[topic]
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={explanation.title}
      footer={
        <Button size="lg" block onClick={onClose}>
          J’ai compris
        </Button>
      }
    >
      <div className={styles.body}>
        {explanation.points.map((p) => (
          <section key={p.heading} className={styles.point}>
            <h3 className={styles.heading}>{p.heading}</h3>
            <p className={styles.text}>{p.body}</p>
          </section>
        ))}
        <p className={styles.closing}>{explanation.closing}</p>
      </div>
    </Sheet>
  )
}
