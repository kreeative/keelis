/**
 * The pro chart: OHLC candles, a price grid, a moving average and a crosshair that reads
 * out open/high/low/close. Offered alongside the line chart from 1024px up — a candle is
 * four numbers in one mark, and below a laptop there is neither the width to separate the
 * bodies nor the pointer to read them.
 *
 * The candles are *derived from the same series the line draws*, bucketed. They are not a
 * second dataset: a pro chart that disagreed with the line above it would be worse than no
 * pro chart at all.
 *
 * There is deliberately no volume histogram. Volume cannot be derived from a price series,
 * and inventing one for an app aimed at real investors would look like information while
 * being none. It needs a market data feed; see the guideline.
 */
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useSettings } from '@/store/settings'
import type { PricePoint } from '@/api/types'
import { cn } from '@/lib/cn'
import styles from './CandleChart.module.css'

export interface Candle {
  /** Bucket start */
  t: number
  o: number
  h: number
  l: number
  c: number
}

export interface CandleChartProps {
  points: PricePoint[]
  /** How many candles to draw. Default: derived so each candle aggregates enough points
      to actually have a high and a low. Clamped to the number of points available. */
  buckets?: number
  height?: number
  /** Simple moving average window, in candles. 0 hides it. */
  sma?: number
  label: string
  loading?: boolean
  className?: string
  formatValue?: (v: number) => string
}

/**
 * Bucket a price series into OHLC candles.
 *
 * Buckets are contiguous and cover every point exactly once, so the candles' first open is
 * the series' first price and the last close is its last — the figure the screen's hero is
 * already showing. Rounding the boundaries rather than flooring keeps the final bucket from
 * collapsing to a single point when the count does not divide evenly.
 */
export function toCandles(points: PricePoint[], buckets: number): Candle[] {
  const n = points.length
  if (n === 0 || buckets < 1) return []
  const count = Math.max(1, Math.min(buckets, n))
  const out: Candle[] = []
  for (let b = 0; b < count; b++) {
    const start = Math.round((b * n) / count)
    const end = Math.round(((b + 1) * n) / count)
    if (end <= start) continue
    let h = -Infinity
    let l = Infinity
    for (let i = start; i < end; i++) {
      const p = points[i]!.p
      if (p > h) h = p
      if (p < l) l = p
    }
    out.push({ t: points[start]!.t, o: points[start]!.p, c: points[end - 1]!.p, h, l })
  }
  return out
}

/** Simple moving average over closes; entries before the window is full are null. */
export function smaSeries(candles: Candle[], window: number): Array<number | null> {
  if (window < 2) return candles.map(() => null)
  const out: Array<number | null> = new Array(candles.length).fill(null)
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i]!.c
    if (i >= window) sum -= candles[i - window]!.c
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

/** Round a price span out to a readable grid: 4 lines on a 1-2-5 step. */
function gridLines(lo: number, hi: number, target = 4): number[] {
  if (!(hi > lo)) return [lo]
  const raw = (hi - lo) / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(v)
  return out
}

/**
 * How many candles a series can actually support.
 *
 * A candle needs points *between* its open and its close to have a high and a low. Slice a
 * 96-point day into 48 candles and every bucket holds two points, so high === open and
 * low === close: the wicks vanish and the chart degenerates into a bar chart wearing a
 * candle's name. Five points per candle is the floor that keeps a wick meaningful.
 */
export function candleCount(pointCount: number): number {
  return Math.max(6, Math.min(60, Math.floor(pointCount / 5)))
}

export function CandleChart({ points, buckets, height = 320, sma = 7, label, loading, className, formatValue }: CandleChartProps) {
  const { locale } = useSettings()
  const id = useId()
  const ref = useRef<SVGSVGElement | null>(null)
  const [W, setW] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  // The chart renders a skeleton before it has an <svg>, so a plain effect would observe
  // nothing. A callback ref runs the moment the node exists — and again if it is replaced.
  const attach = useCallback((node: SVGSVGElement | null) => {
    ref.current = node
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width
      if (w && w > 0) setW(Math.round(w))
    })
    ro.observe(node)
  }, [])

  const H = height
  const PAD_R = 52 // room for the price scale
  const PLOT = Math.max(0, W - PAD_R)

  const candles = useMemo(() => toCandles(points, buckets ?? candleCount(points.length)), [points, buckets])
  const avg = useMemo(() => smaSeries(candles, sma), [candles, sma])

  const { lo, hi } = useMemo(() => {
    let l = Infinity
    let h = -Infinity
    for (const c of candles) {
      if (c.l < l) l = c.l
      if (c.h > h) h = c.h
    }
    if (!Number.isFinite(l)) return { lo: 0, hi: 1 }
    if (h === l) h = l + 1
    const pad = (h - l) * 0.08
    return { lo: l - pad, hi: h + pad }
  }, [candles])

  const y = useCallback((v: number) => H - ((v - lo) / (hi - lo)) * H, [H, lo, hi])
  const slot = candles.length > 0 ? PLOT / candles.length : 0
  const bodyW = Math.max(1, Math.min(14, slot * 0.62))

  const fv = formatValue ?? ((v: number) => formatMoney(v, { locale }))

  const pick = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      const svg = ref.current
      if (!svg || candles.length === 0) return
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const plotPx = rect.width - PAD_R
      if (plotPx <= 0) return
      const i = Math.floor((x / plotPx) * candles.length)
      setActive(i >= 0 && i < candles.length ? i : null)
    },
    [candles.length],
  )
  const leave = useCallback(() => setActive(null), [])

  if (loading || candles.length === 0) {
    return <div className={cn(styles.skeleton, className)} style={{ height }} aria-hidden="true" />
  }

  const grid = gridLines(lo, hi)
  const cur = active !== null ? candles[active] : undefined

  return (
    <div className={cn(styles.wrap, className)}>
      {/* The readout sits above the plot, not in a box over it: the crosshair already says
          where you are, and a floating panel would cover the candles it describes. */}
      <div className={styles.readout} role="status">
        {cur ? (
          <>
            <span className={styles.when}>{formatDateTime(cur.t, { locale })}</span>
            <span className={styles.ohlc}>
              <span><abbr title="Ouverture">O</abbr> {fv(cur.o)}</span>
              <span><abbr title="Plus haut">H</abbr> {fv(cur.h)}</span>
              <span><abbr title="Plus bas">B</abbr> {fv(cur.l)}</span>
              <span className={cur.c >= cur.o ? styles.pos : styles.neg}><abbr title="Clôture">C</abbr> {fv(cur.c)}</span>
            </span>
          </>
        ) : (
          <span className={styles.hint}>Survolez le graphique pour lire chaque chandelier · MM{sma}</span>
        )}
      </div>

      <svg
        ref={attach}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={styles.svg}
        style={{ height }}
        role="img"
        aria-labelledby={`${id}-label`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={leave}
        onPointerCancel={leave}
      >
        <title id={`${id}-label`}>
          {label}. {candles.length} chandeliers, de {fv(candles[0]!.o)} à {fv(candles[candles.length - 1]!.c)}.
        </title>

        {/* Labels at round levels, and no line at any of them: the same rule as the line
            chart's scale, on the owner's instruction — a label at a height is a scale, a rule
            through the candles at that height was decoration. */}
        {grid.map((v) => (
          <text key={v} x={PLOT + 6} y={y(v)} dy="0.32em" className={styles.scale}>
            {fv(v)}
          </text>
        ))}

        {candles.map((c, i) => {
          const cx = i * slot + slot / 2
          const up = c.c >= c.o
          const top = y(Math.max(c.o, c.c))
          const bottom = y(Math.min(c.o, c.c))
          return (
            <g key={c.t} className={up ? styles.up : styles.down}>
              <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} className={styles.wick} />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bottom - top)} className={styles.body} />
            </g>
          )
        })}

        {/* The average is context, so it sits under the crosshair and over the candles. */}
        <path
          d={avg.reduce((d, v, i) => (v === null ? d : `${d}${d ? 'L' : 'M'}${i * slot + slot / 2} ${y(v)}`), '')}
          className={styles.sma}
        />

        {active !== null && cur ? (
          <>
            <line x1={active * slot + slot / 2} x2={active * slot + slot / 2} y1={0} y2={H} className={styles.cross} />
            <line x1={0} x2={PLOT} y1={y(cur.c)} y2={y(cur.c)} className={styles.cross} />
          </>
        ) : null}
      </svg>
    </div>
  )
}
