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
import { formatDateTime, formatMoney } from '@/lib/format'
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
  className?: string
  loading?: boolean
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

export function Chart({ points, height = 200, tone, formatValue, formatTime, onHover, label, className, loading }: ChartProps) {
  const id = useId()
  const { locale } = useSettings()
  const ref = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<number | null>(null)
  /* Measured, so the drawing space equals the painting space. 1000 is only the first
     frame's guess; the observer corrects it before anyone sees a stretched dot. */
  const [W, setW] = useState(1000)
  const H = height
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
      xs[i] = (i / (n - 1)) * W
      ys[i] = PAD + (1 - (points[i]!.p - lo) / (hi - lo)) * (H - PAD * 2)
    }
    return { path: smoothPath(xs, ys), xs, ys, min: lo, max: hi }
  }, [points, H, W])

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
        viewBox={`0 0 ${W} ${H}`}
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
            <rect x="0" y="0" width={W} height={H} fill={`url(#${id}-fade)`} />
          </mask>
          <clipPath id={`${id}-behind`}>
            <rect x="0" y="0" width={Math.max(0, ax)} height={H} />
          </clipPath>
        </defs>
        {/* The series is drawn twice while scrubbing: once dimmed for the whole period, then
            again clipped to everything left of the cursor. What you have scrubbed past
            stays lit and what you have not yet reached recedes, so the eye is held at the
            point being read rather than at the end of the line. */}
        <g className={ai !== null ? styles.ahead : undefined}>
          <path d={`${path}L${W} ${H}L0 ${H}Z`} fill={`url(#${id}-stipple)`} stroke="none" mask={`url(#${id}-fademask)`} />
          <path d={path} className={styles.line} />
          <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} className={styles.nowDot} />
        </g>
        {ai !== null ? (
          <>
            <g clipPath={`url(#${id}-behind)`}>
              <path d={`${path}L${W} ${H}L0 ${H}Z`} fill={`url(#${id}-stipple)`} stroke="none" mask={`url(#${id}-fademask)`} />
              <path d={path} className={styles.line} />
            </g>
            <line x1={ax} x2={ax} y1={0} y2={H} className={styles.cursor} />
            {/* A ring, not a disc: the line runs through the point being read, and a
                filled dot would hide the very shape the cursor is asking about. */}
            <circle cx={ax} cy={ay} r={4} className={styles.scrubDot} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
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
