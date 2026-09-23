/**
 * Explicit success state after a money movement: what happened, status, next step.
 *
 * **This is the third motion allowed to ask for attention**, beside the balance's count-up
 * and the chart's draw-in, and it earns the seat the same way they did: it announces
 * something. A completed transfer is the emotional peak of every money flow — the screen
 * people show each other — and it used to appear the way an error does, all at once, the
 * mark just sitting there. Now the disc pops on the arrival spring, the check **draws
 * itself** through it (the chart's own `pathLength` trick, which is why the check is an
 * inline SVG here rather than the shared `Icon`: lucide's paths do not carry `pathLength`,
 * and drawing a stroke needs it), and the facts follow in the cascade's rhythm. Reduced
 * motion gets the finished screen immediately — a celebration is never information, so
 * losing it costs nothing.
 */
import { useLayoutEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXIT_MS } from '@/lib/motion'
import { Badge, Button } from '@/components'
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

  /* **A success screen starts at the top, and it has to say so twice.** It swaps in on the
     same route, so no navigation scroll restoration runs and it inherits the aperçu's
     offset — the mark, the one thing this screen leads with, played above the fold in a
     captured frame. Once at mount is not enough: the confirmation sheet is still closing at
     that moment, and its freeze hands the old scroll back when it finishes — which is why
     the second call waits out `EXIT_MS`, the same constant the sheet itself keeps. The
     frames only ever looked right by luck: this screen is short, so the browser clamped the
     stale offset to zero. A success with more detail lines would have kept the cut. */
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    const t = setTimeout(() => window.scrollTo(0, 0), EXIT_MS + 30)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <span className={styles.mark}>
        {/* The check draws itself, so it is its own SVG: `pathLength="1"` makes one dash
            cover the stroke whatever its geometry, exactly as the chart's line does. */}
        <svg className={styles.check} viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4.5 12.5 10 18 19.5 7" pathLength="1" />
        </svg>
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
