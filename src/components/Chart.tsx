/**
 * Price line with a stippled area under it that fades out with depth, and a small dot on
 * the last point. The stipple is the interesting part: in a palette with no hue a tinted
 * area fill has nothing to tint, so the area is carried by *texture* instead — a lattice
 * of 1px dots, masked by a vertical fade so it thins out with depth.
 *
 * The viewBox tracks the measured width rather than a fixed 1000, so the SVG is 1:1 with
 * CSS pixels and nothing is stretched — without that the dots render as dashes.
 */
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { formatDateTime, formatMoney, formatTick } from '@/lib/format'
import { useSettings } from '@/store/settings'
import type { PricePoint } from '@/api/types'
import { cn } from '@/lib/cn'
import styles from './Chart.module.css'

export interface ChartProps {
  points: PricePoint[]
  height?: number
  /** Override colour; default derives from first→last delta */
  tone?: 'pos' | 'neg' | 'ink'
  formatValue?: (v: number) => string
  formatTime?: (t: number) => string
  /** Called with the hovered point (or null) so the header can mirror it */
  onHover?: (p: PricePoint | null) => void
  label: string
  /**
   * What identifies *this series*. The draw-in restarts when it changes — a new asset, a
   * new period — and not when the points move under a price tick. Defaults to `label`,
   * which already carries the period on every screen that shows a range.
   */
  drawKey?: string | number
  className?: string
  loading?: boolean
  /**
   * Hang a scale on it: round price levels down the right with a hairline at each, and a
   * handful of times along the bottom.
   *
   * **Off by default, and that is the reference's own distinction.** Its dashboard chart is
   * a bare line, because the figure the chart is about is printed directly above it and the
   * scrub readout swaps into that same figure — a scale there answers a question nobody
   * asked. Its asset page carries the full grid, because on a market screen the levels *are*
   * the question: whether this is near the top of the day, how far the drop went, where the
   * price has been sitting. Same component, two jobs.
   */
  axes?: boolean
  /** Short form for a bottom-axis tick — « 14:05 », « 12 sept. ». Defaults to `formatTime`. */
  formatAxisTime?: (t: number) => string
}

/**
 * Round price levels to hang a scale on, in the manner every trading screen uses: the step
 * is 1, 2, 2.5 or 5 times a power of ten, so the labels read 760.50 · 761.00 · 761.50 and
 * not 760.37 · 761.02 · 761.67.
 *
 * That is the whole reason a scale is worth drawing. Dividing the range into four equal
 * parts is one line of arithmetic and produces five numbers nobody can hold in their head,
 * which is a decoration; rounding the *step* first produces levels a person already thinks
 * in, so two glances at two different periods are comparable.
 *
 * Only ticks **inside** the data's own range are returned. The alternative — widening the
 * plot to the outermost round levels — pads the chart with empty band above and below the
 * line, and on a 132px hero that is most of the chart.
 */
export function niceTicks(lo: number, hi: number, target = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || target < 1) return []
  const raw = (hi - lo) / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  const multiplier = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10
  const step = multiplier * magnitude
  const out: number[] = []
  /* Counted in steps and multiplied back, never accumulated: adding 0.1 to itself thirty
     times lands on 3.0000000000000004, and that prints as a tick label. */
  for (let k = Math.ceil(lo / step); k * step <= hi + step * 1e-9; k++) {
    const v = k * step
    if (v >= lo - step * 1e-9) out.push(Number((v).toFixed(12)))
  }
  return out
}

/**
 * Smooths a series into cubic beziers using monotone (Fritsch–Carlson) interpolation.
 *
 * The choice matters here. A Catmull-Rom or plain cardinal spline curves prettily but
 * *overshoots*: between two points it can swing past both, drawing a peak higher than the
 * highest price in the data. On a price chart that is a lie. Monotone interpolation
 * clamps the tangents so the curve never leaves the interval its two endpoints define —
 * the line rounds off, and every high and low on screen is one that actually happened.
 */
export function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n < 2) return ''
  if (n === 2) return `M${xs[0]!.toFixed(1)} ${ys[0]!.toFixed(1)}L${xs[1]!.toFixed(1)} ${ys[1]!.toFixed(1)}`

  const dx: number[] = new Array(n - 1)
  const slope: number[] = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1]! - xs[i]!
    slope[i] = dx[i]! === 0 ? 0 : (ys[i + 1]! - ys[i]!) / dx[i]!
  }

  const m: number[] = new Array(n)
  m[0] = slope[0]!
  m[n - 1] = slope[n - 2]!
  for (let i = 1; i < n - 1; i++) {
    // a flat spot or a turning point gets a flat tangent, which is what stops the overshoot
    m[i] = slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i]! / slope[i]!
    const b = m[i + 1]! / slope[i]!
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * slope[i]!
      m[i + 1] = t * b * slope[i]!
    }
  }

  let d = `M${xs[0]!.toFixed(1)} ${ys[0]!.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const t = dx[i]! / 3
    d += `C${(xs[i]! + t).toFixed(1)} ${(ys[i]! + m[i]! * t).toFixed(1)} ${(xs[i + 1]! - t).toFixed(1)} ${(ys[i + 1]! - m[i + 1]! * t).toFixed(1)} ${xs[i + 1]!.toFixed(1)} ${ys[i + 1]!.toFixed(1)}`
  }
  return d
}

export function Chart({ points, height = 200, tone, formatValue, formatTime, formatAxisTime, onHover, label, drawKey, className, loading, axes = false }: ChartProps) {
  const id = useId()
  const { locale } = useSettings()
  const ref = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<number | null>(null)
  /* Measured, so the drawing space equals the painting space. 1000 is only the first
     frame's guess; the observer corrects it before anyone sees a stretched dot. */
  const [W, setW] = useState(1000)
  /* The scale is drawn *outside* the plot, so the plot gives up the room rather than the
     labels sitting on top of the line. 56px down the right takes « 93.75 M » at
     `--fs-label` with air to spare, and 20px along the bottom is one line of it. Measured,
     not guessed: a label that overlaps the curve is the failure this is avoiding. */
  const AXIS_W = axes ? 56 : 0
  const AXIS_H = axes ? 20 : 0
  const H = height - AXIS_H
  const PLOT_W = Math.max(0, W - AXIS_W)
  const PAD = 6

  /* A callback ref, not an effect: the chart renders a skeleton first, so by the time an
     effect with an empty dep list runs there is no <svg> yet to observe. */
  const observer = useRef<ResizeObserver | null>(null)
  const attach = useCallback((el: SVGSVGElement | null) => {
    ref.current = el
    observer.current?.disconnect()
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0)
      if (w > 0) setW(w)
    })
    ro.observe(el)
    observer.current = ro
  }, [])

  const { path, xs, ys, min, max } = useMemo(() => {
    const n = points.length
    if (n < 2) return { path: '', xs: [] as number[], ys: [] as number[], min: 0, max: 0 }
    let lo = Infinity
    let hi = -Infinity
    for (const p of points) {
      if (p.p < lo) lo = p.p
      if (p.p > hi) hi = p.p
    }
    if (hi === lo) hi = lo + 1
    const xs: number[] = new Array(n)
    const ys: number[] = new Array(n)
    for (let i = 0; i < n; i++) {
      xs[i] = (i / (n - 1)) * PLOT_W
      ys[i] = PAD + (1 - (points[i]!.p - lo) / (hi - lo)) * (H - PAD * 2)
    }
    return { path: smoothPath(xs, ys), xs, ys, min: lo, max: hi }
  }, [points, H, PLOT_W])

  /* One gridline per ~40px of plot, between three and seven. Fewer than three is not a
     scale and more than seven is hatching; the reference's own asset chart shows six.
     Asked for, not guaranteed — `niceTicks` bends the count to keep the numbers round, so
     a 220px chart that wanted five can come back with four. Asking for one per 56px came
     back with *two* on the phone, which is not a scale, it is two stray lines. */
  const priceTicks = useMemo(() => {
    if (!axes || max <= min) return []
    const wanted = Math.max(3, Math.min(7, Math.round(H / 40)))
    const values = niceTicks(min, max, wanted)
    const step = values.length > 1 ? values[1]! - values[0]! : max - min
    return values.map((v) => ({ v, step, y: PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2) }))
  }, [axes, min, max, H])

  /* And one time label per ~90px — « 15/09/2026 » is the widest of them at about 62, and
     the rest is the gap that keeps two from touching. They are laid out by the same x scale
     as the points, so a label sits under the part of the curve it names. */
  const timeTicks = useMemo(() => {
    if (!axes || points.length < 2 || PLOT_W <= 0) return []
    const count = Math.max(2, Math.min(6, Math.floor(PLOT_W / 90)))
    const out: Array<{ t: number; x: number; i: number }> = []
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1)) * (points.length - 1))
      out.push({ t: points[i]!.t, x: (i / (points.length - 1)) * PLOT_W, i })
    }
    return out
  }, [axes, points, PLOT_W])

  const first = points[0]?.p ?? 0
  const last = points[points.length - 1]?.p ?? 0
  const derived: 'pos' | 'neg' | 'ink' = tone ?? (last > first ? 'pos' : last < first ? 'neg' : 'ink')

  const fv = formatValue ?? ((v: number) => formatMoney(v, { locale }))
  const ft = formatTime ?? ((t: number) => formatDateTime(t, { locale }))

  const pick = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      const svg = ref.current
      if (!svg || points.length < 2) return
      const rect = svg.getBoundingClientRect()
      const rel = (e.clientX - rect.left) / rect.width
      const i = Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))))
      setActive(i)
      onHover?.(points[i] ?? null)
    },
    [points, onHover],
  )
  const leave = useCallback(() => {
    setActive(null)
    onHover?.(null)
  }, [onHover])

  if (loading || points.length < 2) {
    return <div className={cn(styles.skeleton, className)} style={{ height }} aria-hidden="true" />
  }

  const ai = active
  const ax = ai !== null ? xs[ai]! : 0
  const ay = ai !== null ? ys[ai]! : 0

  return (
    <div className={cn(styles.wrap, styles[derived], className)} style={{ height }}>
      <svg
        ref={attach}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className={styles.svg}
        role="img"
        aria-labelledby={`${id}-label`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={leave}
        onPointerCancel={leave}
      >
        <title id={`${id}-label`}>
          {label}. De {fv(first)} à {fv(last)}. Minimum {fv(min)}, maximum {fv(max)}.
        </title>
        <defs>
          {/* 1px dots on a 4px lattice — the area, drawn as texture rather than tint. */}
          <pattern id={`${id}-stipple`} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.85" className={styles.stipple} />
          </pattern>
          {/* The stipple thins out with depth and is gone before the floor, so the texture
              reads as something the line casts rather than a block sitting under it. The
              fade runs down the plot box, not down from the line: measured on the
              reference, ink at a given height is the same whether the line is 17px or
              527px above it. `white` here is a mask value — keep — not a palette colour. */}
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="0.45" stopColor="white" stopOpacity="0.62" />
            <stop offset="0.8" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}-fademask`}>
            <rect x="0" y="0" width={PLOT_W} height={H} fill={`url(#${id}-fade)`} />
          </mask>
          <clipPath id={`${id}-behind`}>
            <rect x="0" y="0" width={Math.max(0, ax)} height={H} />
          </clipPath>
        </defs>
        {/* No gridlines. The scale used to draw a hairline at every round level and one along
            the foot, and the owner asked for them to go: on a dark ground four horizontal
            rules behind a curve read as a ruled page, not a scale. The levels are still
            there — the labels down the right sit exactly on them — and a label at a height
            is a scale; a line through the curve at that height was decoration. */}
        {/* The series is drawn twice while scrubbing: once dimmed for the whole period, then
            again clipped to everything left of the cursor. What you have scrubbed past
            stays lit and what you have not yet reached recedes, so the eye is held at the
            point being read rather than at the end of the line. */}
        {/* Keyed on the series identity, so the draw-in runs when the asset or the period
            changes and **not** on every price tick: a curve that redrew itself every ten
            seconds would be moving exactly when someone is reading it. Remounting the group
            is what restarts the CSS animation. */}
        <g key={drawKey ?? label} className={cn(styles.drawing, ai !== null && styles.ahead)}>
          <path d={`${path}L${PLOT_W} ${H}L0 ${H}Z`} fill={`url(#${id}-stipple)`} stroke="none" mask={`url(#${id}-fademask)`} className={styles.stippleArea} />
          <path d={path} className={styles.line} pathLength={1} />
          <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} className={styles.nowDot} />
        </g>
        {ai !== null ? (
          <>
            <g clipPath={`url(#${id}-behind)`}>
              <path d={`${path}L${PLOT_W} ${H}L0 ${H}Z`} fill={`url(#${id}-stipple)`} stroke="none" mask={`url(#${id}-fademask)`} />
              <path d={path} className={styles.line} />
            </g>
            <line x1={ax} x2={ax} y1={0} y2={H} className={styles.cursor} vectorEffect="non-scaling-stroke" />
            {/* A ring, not a disc: the line runs through the point being read, and a
                filled dot would hide the very shape the cursor is asking about. */}
            <circle cx={ax} cy={ay} r={4} className={styles.scrubDot} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      {/* The labels are HTML, not <text> in the SVG, and that is not a preference. The svg
          carries `preserveAspectRatio="none"` so its viewBox can track the measured width —
          which means that between the first paint and the ResizeObserver's first callback the
          drawing is scaled, and scaled type is smeared type. As HTML they also get
          `--fs-label`, `tabular-nums` and the ink token for nothing, and a screen reader
          skips them: the whole series is already in the <title>. */}
      {axes ? (
        <div className={styles.scale} aria-hidden="true">
          {priceTicks.map((t) => (
            <span key={t.v} className={styles.priceTick} style={{ top: `${t.y}px`, width: `${AXIS_W}px` }}>
              {formatTick(t.v, t.step, { locale })}
            </span>
          ))}
          {timeTicks.map((t) => (
            <span
              key={t.i}
              className={styles.timeTick}
              /* The first is flush left and the last flush right; the rest are centred on
                 their own point. Centring all of them hangs half of the first label off the
                 left edge of the card. */
              style={{ left: `${t.x}px`, transform: t.i === 0 ? 'none' : t.x >= PLOT_W - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {(formatAxisTime ?? ft)(t.t)}
            </span>
          ))}
        </div>
      ) : null}
      {/* No tooltip. The screen's own hero swaps to the scrubbed value and its timestamp
          (see `onHover`), and a floating box repeating it sat directly on top of the very
          number it was duplicating. One readout, in the place the eye already is. */}
      {ai !== null ? (
        <span className={styles.srOnly} role="status">
          {fv(points[ai]!.p)}, {ft(points[ai]!.t)}
        </span>
      ) : null}
    </div>
  )
}

/** Tiny inline line, no interaction. Colour by delta. */
export function Sparkline({ values, width = 72, height = 24, className, tone }: { values: number[]; width?: number; height?: number; className?: string; tone?: 'pos' | 'neg' | 'ink' }) {
  const d = useMemo(() => {
    const n = values.length
    if (n < 2) return ''
    let lo = Infinity
    let hi = -Infinity
    for (const v of values) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (hi === lo) hi = lo + 1
    const xs: number[] = new Array(n)
    const ys: number[] = new Array(n)
    for (let i = 0; i < n; i++) {
      xs[i] = (i / (n - 1)) * width
      ys[i] = 1.5 + (1 - (values[i]! - lo) / (hi - lo)) * (height - 3)
    }
    return smoothPath(xs, ys)
  }, [values, width, height])
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const derived = tone ?? (last > first ? 'pos' : last < first ? 'neg' : 'ink')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn(styles.spark, styles[derived], className)} aria-hidden="true">
      <path d={d} className={styles.line} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
