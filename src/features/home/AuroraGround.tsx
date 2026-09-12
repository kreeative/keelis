/**
 * The colour that drifts under the home sheet.
 *
 * Five very pale fields, wide apart, moving slowly enough that you notice it only if you
 * stop and look — which is the point. It exists on **Accueil only**, in the **light theme
 * only**, and it sits behind the sheet's content, never behind text on its own ground and
 * never behind a control.
 *
 * It fades out as the page scrolls. The top of Accueil is where someone lingers; by the
 * time they are reading the transaction list they want a quiet page, so the wash is gone
 * rather than competing with the rows.
 *
 * Under `prefers-reduced-motion` the fields stop moving but stay where they are: the
 * colour was never the thing that could cause trouble, the motion was.
 */
import { useEffect, useRef } from 'react'
import styles from './AuroraGround.module.css'

/** Scroll distance over which the wash goes from full to its floor. */
const FADE_OVER = 520
/** What is left of it once you are well down the page — present, barely. */
const FLOOR = 0.12

export function AuroraGround() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const apply = () => {
      frame = 0
      const y = window.scrollY
      const t = Math.min(1, Math.max(0, y / FADE_OVER))
      el.style.setProperty('--aurora-fade', String(1 - (1 - FLOOR) * t))
    }
    const onScroll = () => {
      // One write per frame: a scroll handler that touches style on every event is the
      // classic way to make a page that is otherwise cheap feel heavy on a phone.
      if (!frame) frame = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} className={styles.aurora} aria-hidden="true">
      <span className={styles.f1} />
      <span className={styles.f2} />
      <span className={styles.f3} />
      <span className={styles.f4} />
      <span className={styles.f5} />
    </div>
  )
}
