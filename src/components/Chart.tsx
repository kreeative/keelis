/**
 * Price line with a stippled area under it that fades out with depth, the period's opening value as a dashed
 * baseline, and a dot on the last point. The stipple is the interesting part: in a palette
 * with no hue, a tinted area fill has nothing to tint, so the area is carried by *texture*
 * instead — a lattice of 1px dots, which reads as filled without needing colour.
 *
 * The viewBox tracks the measured width rather than a fixed 1000, so the SVG is 1:1 with
 * CSS pixels: dots stay round, dashes keep their length, and nothing is stretched.
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
    let d = ''
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W
      const y = PAD + (1 - (points[i]!.p - lo) / (hi - lo)) * (H - PAD * 2)
      xs[i] = x
      ys[i] = y
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
    }
    return { path: d, xs, ys, min: lo, max: hi }
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

  /* The dashed rule sits at the period's opening value, so above or below it is the whole
     story of the period at a glance. */
  const baseY = ys[0] ?? 0

  const ai = active
  const ax = ai !== null ? xs[ai]! : 0
  const ay = ai !== null ? ys[ai]! : 0
  const tipLeft = ai !== null ? Math.min(Math.max((ax / W) * 100, 12), 88) : 0

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
        </defs>
        <path d={`${path}L${W} ${H}L0 ${H}Z`} fill={`url(#${id}-stipple)`} stroke="none" mask={`url(#${id}-fademask)`} />
        <line x1={0} x2={W} y1={baseY} y2={baseY} className={styles.baseline} />
        <path d={path} className={styles.line} />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={4} className={styles.nowDot} />
        {ai !== null ? (
          <>
            <line x1={ax} x2={ax} y1={0} y2={H} className={styles.cursor} />
          </>
        ) : null}
      </svg>
      {ai !== null ? (
        <>
          <span className={styles.dot} style={{ left: `${(ax / W) * 100}%`, top: ay }} aria-hidden="true" />
          <div className={styles.tooltip} style={{ left: `${tipLeft}%` }} role="status">
            <span className={styles.tipValue}>{fv(points[ai]!.p)}</span>
            <span className={styles.tipTime}>{ft(points[ai]!.t)}</span>
          </div>
        </>
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
    let s = ''
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * width
      const y = 1.5 + (1 - (values[i]! - lo) / (hi - lo)) * (height - 3)
      s += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
    }
    return s
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
