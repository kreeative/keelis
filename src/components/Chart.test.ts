import { describe, expect, it } from 'vitest'
import { smoothPath } from './Chart'

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
