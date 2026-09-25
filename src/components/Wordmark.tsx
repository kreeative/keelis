/**
 * Keewal Meere marks.
 *
 * **The wordmark is the owner's artwork.** « Keewal Meere » drawn in the face of the first
 * logo, supplied by the owner as a PDF of the brand sheet: « the brand name in full letters
 * is to replace the sans-serif font… I don't want to see the brand name written in
 * sans-serif when here is the logo ». It replaces the stand-in that set the name in Outfit
 * Black while the repository had no artwork for the new name. The face itself
 * (EtherealDemo-ExtraBold) is still never set as live text and never shipped as a webfont:
 * the name ships as a drawing, which is how the old wordmark shipped too.
 *
 * It is drawn as a **mask**, not shown as a picture: `public/brand/wordmark.png` is the
 * sheet's white letters on transparency, and the element paints `currentColor` through
 * them. So one file is the ink on the cream page, the paper on the dark theme and the
 * engraved gold on the card, with no second export to keep in step.
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
  /** Force one version of the disc. Leave unset to follow the theme. */
  tone?: 'ink' | 'paper'
}

export function Wordmark({ size = 'md', className, glyphOnly = false, tone }: WordmarkProps) {
  if (glyphOnly) {
    return <span className={cn(styles.disc, tone && styles[tone], styles[size], className)} role="img" aria-label="Keewal Meere" />
  }
  return (
    <span className={cn(styles.mark, styles[size], className)} role="img" aria-label="Keewal Meere">
      <span className={styles.word} />
    </span>
  )
}
