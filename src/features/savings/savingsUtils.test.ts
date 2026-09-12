import { describe, expect, it } from 'vitest'
import { MASKED, formatMoney } from '@/lib/format'
import { dateInMonths, estimateInterest, formatApy, formatMonthYear, formatWholePercent, goalPercent, goalProgress, inlineMoney, monthsToTarget, sanitizeAmountInput, toKeypadRaw, unallocated } from './savingsUtils'

describe('goal maths', () => {
  it('counts the months left, rounding up', () => {
    expect(monthsToTarget(3_500, 1_850, 250)).toBe(7)
    expect(monthsToTarget(1_000, 1_000, 100)).toBe(0)
    expect(monthsToTarget(1_000, 0, 0)).toBeNull()
  })

  it('clamps progress and rounds the percentage', () => {
    expect(goalProgress(1_850, 3_500)).toBeCloseTo(0.5286, 4)
    expect(goalProgress(5_000, 3_500)).toBe(1)
    expect(goalProgress(100, 0)).toBe(0)
    expect(goalPercent(1_850, 3_500)).toBe(53)
  })

  it('lands on the first day of the target month', () => {
    const d = dateInMonths(7, new Date(2026, 8, 11))
    expect(d.getFullYear()).toBe(2027)
    expect(d.getMonth()).toBe(3)
    expect(d.getDate()).toBe(1)
  })

  it('subtracts allocated goals from the balance', () => {
    expect(unallocated(12_640.15, [{ current: 1_850 }, { current: 6_200 }])).toBeCloseTo(4_590.15, 2)
    expect(unallocated(100, [{ current: 500 }])).toBe(0)
    expect(unallocated(undefined, [])).toBeUndefined()
  })
})

describe('interest projection', () => {
  it('is simple interest over the period', () => {
    expect(estimateInterest(1_000, 4)).toBeCloseTo(40, 6)
    expect(estimateInterest(1_000, 4, 6)).toBeCloseTo(20, 6)
    expect(estimateInterest(0, 4)).toBe(0)
  })
})

describe('formatting', () => {
  it('writes the APY with two decimals and the month in French', () => {
    expect(formatApy(4, 'fr-SN')).toBe('4.00 %')
    expect(formatWholePercent(52.86, 'fr-SN')).toBe('53 %')
    expect(formatMonthYear(new Date(2027, 3, 1), 'fr-SN')).toBe('avril 2027')
  })

  it('masks an amount written inside a sentence when balances are hidden', () => {
    expect(inlineMoney(3_500, false, { locale: 'fr-SN' })).toBe(formatMoney(3_500, { locale: 'fr-SN' }))
    expect(inlineMoney(3_500, true, { locale: 'fr-SN' })).toBe(MASKED)
  })
})

describe('keypad + field input', () => {
  it('round-trips amounts', () => {
    expect(toKeypadRaw(3_500)).toBe('3500')
    expect(toKeypadRaw(12.5)).toBe('12,5')
    expect(toKeypadRaw(0)).toBe('')
  })

  it('keeps digits and a single separator', () => {
    expect(sanitizeAmountInput('1a2,3')).toBe('12,3')
    expect(sanitizeAmountInput('1,2,3')).toBe('1,23')
    expect(sanitizeAmountInput('12,345')).toBe('12,34')
  })
})
