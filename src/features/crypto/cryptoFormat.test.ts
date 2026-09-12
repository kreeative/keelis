import { describe, expect, it } from 'vitest'
import { abbreviateAddress, formatCompactMoney, formatCompactQuantity, formatRate, monthlyTotal, toKeypadRaw, floorTo } from './cryptoFormat'

const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatCompactMoney', () => {
  it('uses T / G / M / k in fr-SN', () => {
    expect(norm(formatCompactMoney(2_830_000_000_000, 'fr-SN'))).toBe('2.83 T F CFA')
    expect(norm(formatCompactMoney(48_000_000_000, 'fr-SN'))).toBe('48.0 G F CFA')
    expect(norm(formatCompactMoney(156_000_000_000, 'fr-SN'))).toBe('156 G F CFA')
    expect(norm(formatCompactMoney(900_000_000, 'fr-SN'))).toBe('900 M F CFA')
    expect(norm(formatCompactMoney(12_500, 'fr-SN'))).toBe('12.5 k F CFA')
  })
  it('uses T / B / M / K in en-NG', () => {
    expect(norm(formatCompactMoney(2_830_000_000_000, 'en-NG'))).toBe('F CFA 2.83T')
    expect(norm(formatCompactMoney(48_000_000_000, 'en-NG'))).toBe('F CFA 48.0B')
  })
  it('falls back to a plain amount under 1 000', () => {
    expect(norm(formatCompactMoney(842.5, 'fr-SN'))).toBe('843 F CFA')
  })
})

describe('formatCompactQuantity', () => {
  it('keeps the symbol', () => {
    expect(norm(formatCompactQuantity(19_820_000, 'BTC', 'fr-SN'))).toBe('19.8 M BTC')
    expect(norm(formatCompactQuantity(57_000_000_000, 'XRP', 'en-NG'))).toBe('57.0B XRP')
  })
})

describe('formatRate', () => {
  it('shows a fraction as a percent with two decimals', () => {
    expect(norm(formatRate(0.015, 'fr-SN'))).toBe('1.50 %')
    expect(norm(formatRate(0.02, 'en-NG'))).toBe('2.00 %')
  })
})

describe('monthlyTotal', () => {
  it('normalises frequencies and ignores paused buys', () => {
    const total = monthlyTotal([
      { amount: 50, frequency: 'weekly', active: true },
      { amount: 100, frequency: 'monthly', active: true },
      { amount: 10, frequency: 'daily', active: false },
    ])
    expect(total).toBeCloseTo(50 * 4.33 + 100, 5)
  })
})

describe('keypad helpers', () => {
  it('converts numbers to keypad strings without trailing zeros', () => {
    expect(toKeypadRaw(0.0007, 8)).toBe('0,0007')
    expect(toKeypadRaw(100, 2)).toBe('100')
    expect(toKeypadRaw(12.5, 2)).toBe('12,5')
    expect(toKeypadRaw(0, 2)).toBe('')
  })
  it('floors to a precision', () => {
    expect(floorTo(4218.379, 2)).toBe(4218.37)
    expect(floorTo(0.04279999, 8)).toBe(0.04279999)
  })
})

describe('abbreviateAddress', () => {
  it('keeps 6 + 4 characters', () => {
    expect(abbreviateAddress('bc1qabcdefghijklmnopqrstuvwxyz')).toBe('bc1qab…wxyz')
    expect(abbreviateAddress('short')).toBe('short')
  })
})
