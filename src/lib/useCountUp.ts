/**
 * A figure settling into place.
 *
 * The owner asked twice for the motion an Apple app has, and this is half of the answer:
 * the balance does not appear, it **arrives** — counting from a lower figure to the real
 * one over about two thirds of a second, decelerating the whole way. It is the one piece
 * of motion in this app that draws attention to something rather than getting out of the
 * way, and the balance is the only thing on the screen that has earned that.
 *
 * Four rules, and they are what keep it from becoming a gimmick:
 *
 * 1. **It runs once, when the figure first lands.** A balance that re-counted on every
 *    price tick — and the Actifs balance moves every ten seconds — would be a fidget
 *    rather than a flourish, and it would be moving exactly when someone is reading it.
 * 2. **It never runs while scrubbing a chart.** Accueil swaps the hero for the scrubbed
 *    value as the finger moves; animating between those would lag the finger and make the
 *    number unreadable. Call sites pass `animate={false}` there, and the value snaps.
 * 3. **`prefers-reduced-motion` gets the final figure immediately.** Not a shorter
 *    animation — none.
 * 4. **It ends exactly on the value.** The last frame is assigned, never interpolated, so
 *    a balance cannot settle one franc away from the truth because of rounding.
 *
 * The duration deliberately exceeds the app's 150–250 ms band, which governs *transitions*
 * — a control answering a touch. A number settling is a different thing and reads as
 * hurried at 250 ms. It has its own token so the value still lives in one place.
 */
import { useEffect, useRef, useState } from 'react'

/** Matches `--dur-figure` in tokens.css. */
export const FIGURE_MS = 650

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Decelerating: fast at the start, settling at the end. No overshoot — nothing bounces. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

export function useCountUp(value: number | undefined, animate: boolean): number | undefined {
  const [shown, setShown] = useState<number | undefined>(undefined)
  const frame = useRef(0)
  /** True once a figure has arrived: the animation belongs to the arrival, and only to it. */
  const arrived = useRef(false)

  useEffect(() => {
    if (value === undefined) {
      setShown(undefined)
      return
    }

    /* Only the first landing animates. A balance that re-counted on every price tick — and
       the Actifs balance moves every ten seconds — would be a fidget rather than a
       flourish, and it would be moving exactly when someone is trying to read it. */
    if (arrived.current || !animate || prefersReducedMotion()) {
      arrived.current = true
      setShown(value)
      return
    }

    arrived.current = true
    const from = openingValue(value)
    const start = performance.now()
    setShown(from)
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FIGURE_MS)
      // The final frame is the value itself, not an interpolation of it: a balance must not
      // settle a franc away from the truth because of rounding.
      if (t >= 1) {
        setShown(value)
        return
      }
      setShown(from + (value - from) * easeOut(t))
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value, animate])

  return shown
}

/**
 * The figure to count up *from*.
 *
 * Starting at zero turns every balance into a slot machine and takes the whole duration to
 * become readable. Starting near the answer — four fifths of it — reads as the number
 * settling rather than being tallied, which is what an arriving balance actually does.
 */
export function openingValue(value: number): number {
  return value * 0.82
}
