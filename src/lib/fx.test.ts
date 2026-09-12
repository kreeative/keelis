import { describe, expect, it } from 'vitest'
import { CURRENCIES, CURRENCY_ORDER, roundTo } from './currency'
import { SPREADS, convertAtMid, midRate, quote, spreadTier } from './fx'

describe('the euro peg', () => {
  it('is exact in both directions — it is a treaty, not a quote', () => {
    expect(midRate('EUR', 'XOF')).toBe(655.957)
    expect(midRate('EUR', 'XAF')).toBe(655.957)
    // 10 000 XOF is famously 15,24 € — the peg's round number in the other direction.
    expect(convertAtMid(10_000, 'XOF', 'EUR')).toBeCloseTo(15.24, 2)
  })

  it('makes XOF and XAF exactly one for one, since they share the peg', () => {
    expect(midRate('XOF', 'XAF')).toBe(1)
    expect(midRate('XAF', 'XOF')).toBe(1)
  })

  it('still charges the pegged pair — same rate, two central banks', () => {
    const q = quote('XOF', 'XAF', 100_000)
    expect(q.midRate).toBe(1)
    expect(q.tier).toBe('pegged')
    expect(q.spread).toBe(SPREADS.pegged)
    expect(q.amountOut).toBe(99_000)
  })
})

describe('spread tiers', () => {
  it('prices by how many legs the pair really is', () => {
    expect(spreadTier('EUR', 'USD')).toBe('anchor')
    expect(spreadTier('EUR', 'NGN')).toBe('single')
    expect(spreadTier('XOF', 'EUR')).toBe('single')
    expect(spreadTier('NGN', 'KES')).toBe('cross')
    expect(spreadTier('XOF', 'XAF')).toBe('pegged')
  })

  it('costs more to cross two African currencies than to go through an anchor', () => {
    expect(SPREADS.cross).toBeGreaterThan(SPREADS.single)
    expect(SPREADS.single).toBeGreaterThan(SPREADS.anchor)
  })

  it('is symmetric — direction does not change the tier', () => {
    for (const a of CURRENCY_ORDER) {
      for (const b of CURRENCY_ORDER) {
        expect(spreadTier(a, b)).toBe(spreadTier(b, a))
      }
    }
  })
})

describe('quote', () => {
  it('takes the spread off the amount and says so explicitly', () => {
    const q = quote('EUR', 'XOF', 100)
    expect(q.midRate).toBe(655.957)
    expect(q.rate).toBeCloseTo(655.957 * (1 - SPREADS.single), 6)
    // The user must be able to see the fee as money, not only as a percentage.
    expect(q.feeIn).toBeCloseTo(100 * SPREADS.single, 2)
    expect(q.amountOut).toBeLessThan(convertAtMid(100, 'EUR', 'XOF'))
  })

  it('rounds to the destination currency, not to two decimals', () => {
    // XOF has no centimes: a result carrying them would be unpayable.
    const toXof = quote('EUR', 'XOF', 37.5)
    expect(Number.isInteger(toXof.amountOut)).toBe(true)
    // TND is quoted in millimes — three decimals, not two.
    const toTnd = quote('EUR', 'TND', 100)
    expect(roundTo(toTnd.amountOut, 'TND')).toBe(toTnd.amountOut)
    expect(Math.round(toTnd.amountOut * 1000)).toBe(toTnd.amountOut * 1000)
  })

  it('never returns more than the unmarked rate would give', () => {
    for (const from of CURRENCY_ORDER) {
      for (const to of CURRENCY_ORDER) {
        if (from === to) continue
        const q = quote(from, to, 1000)
        expect(q.amountOut).toBeLessThanOrEqual(convertAtMid(1000, from, to))
        expect(q.rate).toBeLessThan(q.midRate)
      }
    }
  })

  it('is a no-op on the same currency, with no fee', () => {
    const q = quote('XOF', 'XOF', 12_345)
    expect(q.amountOut).toBe(12_345)
    expect(q.feeIn).toBe(0)
    expect(q.spread).toBe(0)
  })

  it('treats a missing, negative or non-finite amount as zero rather than propagating it', () => {
    for (const bad of [0, -50, NaN, Infinity]) {
      const q = quote('XOF', 'EUR', bad)
      expect(q.amountIn).toBe(0)
      expect(q.amountOut).toBe(0)
      expect(q.feeIn).toBe(0)
    }
  })

  it('rounds once at the end, so a round trip loses only the two spreads', () => {
    // Rounding mid-calculation would show up here as a much larger loss than 2 x spread.
    const out = quote('XOF', 'EUR', 1_000_000)
    const back = quote('EUR', 'XOF', out.amountOut)
    const expected = 1_000_000 * (1 - SPREADS.single) ** 2
    expect(back.amountOut).toBeGreaterThan(expected * 0.999)
    expect(back.amountOut).toBeLessThan(expected * 1.001)
  })
})

describe('the currency registry', () => {
  it('lists every currency exactly once, in a display order', () => {
    expect([...CURRENCY_ORDER].sort()).toEqual(Object.keys(CURRENCIES).sort())
    expect(new Set(CURRENCY_ORDER).size).toBe(CURRENCY_ORDER.length)
  })

  it('agrees with Intl about minor units — the arithmetic and the display cannot diverge', () => {
    for (const code of CURRENCY_ORDER) {
      const intl = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).resolvedOptions()
      expect(CURRENCIES[code].decimals).toBe(intl.minimumFractionDigits)
    }
  })

  it('marks both CFA francs as pegged and nothing else', () => {
    const pegged = CURRENCY_ORDER.filter((c) => CURRENCIES[c].pegged)
    expect(pegged).toEqual(['XOF', 'XAF'])
  })
})
