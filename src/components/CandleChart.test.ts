import { describe, expect, it } from 'vitest'
import { candleCount, smaSeries, toCandles, type Candle } from './CandleChart'

const series = (prices: number[]) => prices.map((p, i) => ({ t: i * 1000, p }))

describe('toCandles', () => {
  it('covers every point exactly once, so the ends match the series', () => {
    const prices = [10, 12, 9, 11, 15, 13, 14, 8, 16, 12]
    const candles = toCandles(series(prices), 4)
    expect(candles[0]!.o).toBe(prices[0])
    expect(candles[candles.length - 1]!.c).toBe(prices[prices.length - 1])
  })

  it("never invents a high or a low the series did not reach", () => {
    const prices = [10, 12, 9, 11, 15, 13, 14, 8, 16, 12]
    const candles = toCandles(series(prices), 3)
    const hi = Math.max(...prices)
    const lo = Math.min(...prices)
    for (const c of candles) {
      expect(c.h).toBeLessThanOrEqual(hi)
      expect(c.l).toBeGreaterThanOrEqual(lo)
      // A candle's body always sits inside its own wick.
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c))
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c))
    }
    // Together the candles reach the series' true extremes.
    expect(Math.max(...candles.map((c) => c.h))).toBe(hi)
    expect(Math.min(...candles.map((c) => c.l))).toBe(lo)
  })

  it('does not collapse a bucket when the count does not divide evenly', () => {
    // 10 points into 3 buckets: rounding boundaries rather than flooring keeps the last
    // bucket from being left with a single point.
    const candles = toCandles(series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 3)
    expect(candles).toHaveLength(3)
    expect(candles.every((c) => c.h >= c.l)).toBe(true)
  })

  it('clamps the bucket count to the points available and handles the empty case', () => {
    expect(toCandles(series([1, 2, 3]), 50)).toHaveLength(3)
    expect(toCandles([], 10)).toEqual([])
    expect(toCandles(series([1, 2, 3]), 0)).toEqual([])
  })
})

describe('smaSeries', () => {
  const c = (close: number): Candle => ({ t: 0, o: close, h: close, l: close, c: close })

  it('is null until the window is full, then averages the last N closes', () => {
    const out = smaSeries([1, 2, 3, 4, 5].map(c), 3)
    expect(out[0]).toBeNull()
    expect(out[1]).toBeNull()
    expect(out[2]).toBe(2) // (1+2+3)/3
    expect(out[3]).toBe(3) // (2+3+4)/3
    expect(out[4]).toBe(4) // (3+4+5)/3
  })

  it('holds over a long series rather than drifting as the window slides', () => {
    const closes = Array.from({ length: 60 }, (_, i) => i + 1)
    const out = smaSeries(closes.map(c), 10)
    // Last window is 51..60, mean 55.5. A sliding sum that failed to subtract correctly
    // would drift steadily, so checking the far end is what catches it.
    expect(out[59]).toBeCloseTo(55.5, 10)
  })

  it('hides itself for a window below 2', () => {
    expect(smaSeries([1, 2, 3].map(c), 1).every((v) => v === null)).toBe(true)
  })
})

describe('candleCount', () => {
  it('leaves enough points per candle for a wick to exist', () => {
    // The bug this guards: 96 points sliced into 48 candles gives two points per bucket,
    // so high === open and low === close and every wick disappears.
    for (const n of [96, 120, 168, 365, 520]) {
      const count = candleCount(n)
      expect(n / count).toBeGreaterThanOrEqual(5)
    }
  })

  it('stays in a drawable range for tiny and huge series', () => {
    expect(candleCount(0)).toBe(6)
    expect(candleCount(7)).toBe(6)
    expect(candleCount(100_000)).toBe(60)
  })
})
