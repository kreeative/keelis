/**
 * Keewal Meere marks.
 *
 * **The wordmark is set as live text, and that is a stopgap.** It used to be a single
 * bezier path traced from the brand sheet — but that path spelled *Keelis*, and artwork
 * cannot be re-traced for a name it was never drawn for. The name is typeset in
 * `--font-brand` — Outfit at its black weight, tracked tight, the face the owner chose for
 * the card once Playfair was rejected and the first logo's EtherealDemo-ExtraBold turned
 * out never to have been in the repository. It stands in until the owner supplies or
 * licenses the real one: Ethereal is a demo release with no commercial licence, and the old
 * wordmark only escaped that by shipping as outlines rather than as type.
 *
 * **Where the name goes, it takes the K's place.** The owner: « Keewal Meere should have
 * the same position as the K ». The welcome screen sets the name where the disc stood,
 * above the greeting, on the phone and on the laptop alike; the disc keeps the rail, where
 * a name does not fit in 56px.
 *
 * The monogram survives the rename intact, because the new name also starts with K. It is
 * *not* traced: the brand sheet draws it embossed, with a raised K and a lit rim, and a
 * flat vector throws that away. It is the sheet's own image, in its two versions — ink
 * disc for a light page, paper disc for a dark one — selected by `--mark-disc` so only
 * the used one is ever fetched.
 */
import styles from './Wordmark.module.css'
import { cn } from '@/lib/cn'

export interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Just the K in its disc — for the rail, the avatar, the card. */
  glyphOnly?: boolean
  /** Force one version. Leave unset to follow the theme. */
  tone?: 'ink' | 'paper'
}

export function Wordmark({ size = 'md', className, glyphOnly = false, tone }: WordmarkProps) {
  if (glyphOnly) {
    return <span className={cn(styles.disc, tone && styles[tone], styles[size], className)} role="img" aria-label="Keewal Meere" />
  }
  return (
    <span className={cn(styles.mark, styles[size], className)} role="img" aria-label="Keewal Meere">
      <span className={styles.word} aria-hidden="true">Keewal&nbsp;Meere</span>
    </span>
  )
}
