import { describe, expect, it } from 'vitest'
import { niceTicks, smoothPath } from './Chart'

/** Walk every cubic in the path and sample it, so we can assert on the drawn curve. */
function sample(d: string, steps = 24): Array<{ x: number; y: number }> {
  const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number)
  const out: Array<{ x: number; y: number }> = []
  const move = d.match(/^M([^CL]+)/)
  if (!move) return out
  let [px, py] = nums(move[1]!) as [number, number]
  out.push({ x: px, y: py })
  for (const m of d.matchAll(/C([^C]+)/g)) {
    const [c1x, c1y, c2x, c2y, x, y] = nums(m[1]!) as [number, number, number, number, number, number]
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const u = 1 - t
      out.push({
        x: u ** 3 * px + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x,
        y: u ** 3 * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y,
      })
    }
    px = x
    py = y
  }
  return out
}

describe('smoothPath', () => {
  it('rounds the corners — the path is curves, not line segments', () => {
    const d = smoothPath([0, 10, 20, 30], [10, 0, 14, 4])
    expect(d).toContain('C')
    expect(d).not.toContain('L')
  })

  it('never draws a high or a low that is not in the data', () => {
    // a spike: a plain spline would swing past the peak on the way in and out
    const xs = [0, 10, 20, 30, 40, 50]
    const ys = [50, 48, 6, 47, 49, 46]
    const pts = sample(smoothPath(xs, ys))
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    const drawnLo = Math.min(...pts.map((p) => p.y))
    const drawnHi = Math.max(...pts.map((p) => p.y))
    expect(drawnLo).toBeGreaterThanOrEqual(lo - 0.001)
    expect(drawnHi).toBeLessThanOrEqual(hi + 0.001)
  })

  it('keeps a flat run flat — a savings balance does not ripple between deposits', () => {
    const xs = [0, 10, 20, 30, 40, 50]
    const ys = [40, 40, 40, 20, 20, 20]
    const flat = sample(smoothPath(xs, ys)).filter((p) => p.x <= 20)
    for (const p of flat) expect(Math.abs(p.y - 40)).toBeLessThan(0.001)
  })

  it('is monotone where the data is monotone', () => {
    const xs = [0, 10, 20, 30, 40]
    const ys = [40, 32, 25, 12, 4] // strictly rising price (y falls)
    const pts = sample(smoothPath(xs, ys))
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.y).toBeLessThanOrEqual(pts[i - 1]!.y + 0.001)
  })

  it('degenerates safely', () => {
    expect(smoothPath([], [])).toBe('')
    expect(smoothPath([0], [5])).toBe('')
    expect(smoothPath([0, 10], [5, 7])).toBe('M0.0 5.0L10.0 7.0')
  })
})

describe('niceTicks', () => {
  it('steps in round numbers, not in quarters of the range', () => {
    // The SPY range in the reference. A quarter of it is 0.70, and the nice step at or
    // above that is a whole dollar — so four *asked for* is three drawn, which is the
    // point: the count bends to keep the numbers round, never the other way.
    expect(niceTicks(758.6, 761.4)).toEqual([759, 760, 761])
    // Ask for more lines and it finds the half-dollar levels the reference shows.
    expect(niceTicks(758.6, 761.4, 7)).toEqual([759, 759.5, 760, 760.5, 761])
  })

  it('stays inside the data — a scale never invents headroom', () => {
    for (const t of niceTicks(93_210_000, 93_790_000)) {
      expect(t).toBeGreaterThanOrEqual(93_210_000)
      expect(t).toBeLessThanOrEqual(93_790_000)
    }
  })

  it('picks a step of 1, 2, 2.5 or 5 times a power of ten', () => {
    for (const [lo, hi] of [[0, 1], [0, 7], [0, 3], [0, 43], [0, 0.004], [12, 12.9], [-8, 8]] as const) {
      const ticks = niceTicks(lo, hi)
      if (ticks.length < 2) continue
      const step = ticks[1]! - ticks[0]!
      const mantissa = step / 10 ** Math.floor(Math.log10(step))
      expect([1, 2, 2.5, 5, 10].some((m) => Math.abs(m - mantissa) < 1e-9)).toBe(true)
    }
  })

  it('is evenly spaced — accumulating the step would drift', () => {
    const ticks = niceTicks(0, 3)
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]!)
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 9)
    // and the labels are the numbers, not 0.30000000000000004
    for (const t of niceTicks(0, 1)) expect(String(t).length).toBeLessThan(6)
  })

  it('gives nothing back for a range that is not one', () => {
    expect(niceTicks(5, 5)).toEqual([])
    expect(niceTicks(9, 4)).toEqual([])
    expect(niceTicks(NaN, 4)).toEqual([])
  })
})
