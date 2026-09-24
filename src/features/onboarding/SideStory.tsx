/**
 * The editorial column beside the sign-in and the sign-up on a laptop.
 *
 * The owner photographed the reference's login on a monitor: the form is a card on the
 * right, and the left half is a story — an eyebrow, a headline, a paragraph, and under
 * them a photograph in a rounded frame. Ours had the form and nothing else, and the owner
 * said so: « the web app should have an image on the side ». This is that column, written
 * once and mounted by both screens, so the two doors cannot tell two stories.
 *
 * The reference's story is a promotion; ours is what the product is, in one sentence each,
 * with no figure the codebase cannot point at. The picture is the welcome photograph — the
 * same mask the phone opens on, so the door looks like one door at every width.
 */
import { Photo, hasPhoto } from '@/components'
import { cn } from '@/lib/cn'
import styles from './SideStory.module.css'

export function SideStory({ className }: { className?: string }) {
  return (
    <aside className={cn(styles.story, className)} aria-label="Ce que Keewal Meere réunit">
      <p className={`t-label ${styles.eyebrow}`}>Marchés · Chèque · Épargne · Change</p>
      <h2 className={styles.headline}>Vos actions africaines et votre épargne, au même endroit.</h2>
      <p className={styles.lede}>
        Sonatel, Dangote, Safaricom et Bitcoin dans un même portefeuille, un compte Chèque en francs CFA, une épargne rémunérée chaque mois, et un change dont la marge est affichée avant que vous confirmiez.
      </p>
      {hasPhoto('welcome') ? <Photo name="welcome" className={styles.frame} sizes="(min-width: 1024px) 44vw, 100vw" /> : null}
    </aside>
  )
}
