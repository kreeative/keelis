import { describe, expect, it } from 'vitest'
import { maskedMoney, formatAmountInput, formatCrypto, formatDayHeading, formatMoney, formatNumber, formatPercent, moneyAriaLabel, parseAmountInput } from './format'

const norm = (v: string) => v.replace(/[\u202f\u00a0]/g, ' ')

const NNBSP = ' '
const NBSP = ' '

describe('formatMoney', () => {
  it('punctuates digits the same way in every locale: comma groups, point decimates', () => {
    // Deliberately not French typography. One punctuation app-wide, so a figure reads the
    // same here as on the statement someone compares it against.
    expect(formatMoney(1234567.89, { locale: 'fr-SN' })).toBe(`1,234,568${NBSP}F${NNBSP}CFA`)
    expect(formatMoney(1234567.89, { locale: 'fr-SN', currency: 'EUR' })).toBe(`1,234,567.89${NBSP}€`)
    // The CFA franc has no centimes, so the amount rounds to whole francs above.
  })
  it('formats en-NG, which puts the symbol first', () => {
    expect(formatMoney(1234.5, { locale: 'en-NG' })).toBe(`F${NNBSP}CFA${NBSP}1,235`)
    expect(formatMoney(1234.5, { locale: 'en-NG', currency: 'NGN' })).toBe('₦1,234.50')
  })
  it('adds explicit sign when requested', () => {
    expect(formatMoney(12.4, { locale: 'fr-SN', signed: true })).toBe(`+12${NBSP}F${NNBSP}CFA`)
    expect(formatMoney(-12.4, { locale: 'fr-SN', currency: 'EUR', signed: true })).toBe(`-12.40${NBSP}€`)
  })
  it('never renders negative zero', () => {
    expect(formatMoney(-0.001, { locale: 'fr-SN' })).toBe(`0${NBSP}F${NNBSP}CFA`)
  })
  it('asks each currency how many decimals it is quoted in', () => {
    // XOF has none, TND is quoted in millimes, most have two. Getting this from Intl per
    // currency rather than hardcoding 2 is the whole point.
    expect(formatMoney(1500, { locale: 'fr-SN' })).not.toContain('.')
    expect(formatMoney(1500.5, { locale: 'fr-SN', currency: 'TND' })).toContain('.500')
    expect(formatMoney(1500.5, { locale: 'fr-SN', currency: 'EUR' })).toContain('.50')
  })
})

describe('formatPercent', () => {
  it('signs, and decimates with a point like every other figure', () => {
    expect(formatPercent(1.4, { locale: 'fr-SN' })).toBe(`+1.4${NBSP}%`)
    expect(formatPercent(-0.86, { locale: 'fr-SN' })).toBe(`-0.86${NBSP}%`)
  })
})

describe('formatCrypto', () => {
  it('trims to sensible decimals', () => {
    expect(formatCrypto(0.0428, 'BTC', { locale: 'fr-SN' })).toBe(`0.0428${NBSP}BTC`)
    expect(formatCrypto(12.5, 'SOL', { locale: 'fr-SN' })).toBe(`12.5${NBSP}SOL`)
    expect(formatCrypto(1234.5678, undefined, { locale: 'fr-SN' })).toBe('1,234.57')
  })
})

describe('amount input', () => {
  it('parses comma and dot decimals', () => {
    expect(parseAmountInput('1234,56')).toBe(1234.56)
    expect(parseAmountInput('1234.56')).toBe(1234.56)
    expect(parseAmountInput('')).toBe(0)
  })
  it('formats while typing', () => {
    expect(formatAmountInput('', 'fr-SN')).toBe('0')
    expect(formatAmountInput('1234', 'fr-SN')).toBe('1,234')
    expect(formatAmountInput('1234,5', 'fr-SN')).toBe('1,234.5')
    // A trailing separator has to survive: it is the state between pressing the decimal
    // key and typing the first decimal digit.
    expect(formatAmountInput('0,', 'fr-SN')).toBe('0.')
    expect(formatAmountInput('1234,5', 'en-NG')).toBe('1,234.5')
  })
})

describe('dates', () => {
  it('uses Aujourd’hui / Hier headings', () => {
    const now = new Date(2026, 8, 10, 15)
    expect(formatDayHeading(new Date(2026, 8, 10, 8), { locale: 'fr-SN', now })).toBe("Aujourd'hui")
    expect(formatDayHeading(new Date(2026, 8, 9, 23), { locale: 'fr-SN', now })).toBe('Hier')
    expect(formatDayHeading(new Date(2026, 8, 1, 12), { locale: 'fr-SN', now })).toMatch(/^Mardi 1 septembre$/)
  })
})

describe('a11y', () => {
  it('produces a long-form label', () => {
    // A screen reader gets the currency's full name, not its symbol — "F CFA" read aloud
    // is three letters and a shrug.
    expect(moneyAriaLabel(1234.56, { locale: 'fr-SN' })).toMatch(/francs CFA/)
    expect(moneyAriaLabel(1234.56, { locale: 'fr-SN', currency: 'NGN' })).toMatch(/nairas/)
  })
})

describe('maskedMoney', () => {
  it('keeps the currency symbol on the side the locale puts it', () => {
    expect(norm(maskedMoney({ locale: 'fr-SN' }))).toBe('••••• F CFA')
    expect(norm(maskedMoney({ locale: 'en-NG' }))).toBe('F CFA •••••')
    expect(norm(maskedMoney({ locale: 'fr-SN', currency: 'EUR' }))).toBe('••••• €')
  })
})

describe('one punctuation, everywhere', () => {
  it('formats a percentage with a point decimal, like every other figure', () => {
    // The rule lives in `joinParts`; anything that reaches for a bare `Intl.NumberFormat`
    // silently gets French typography instead. `Delta` did, and printed « +8,01 % » next
    // to « +346,345 F CFA » — comma decimal against comma thousands, same line.
    expect(formatPercent(8.01, { locale: 'fr-SN' })).toContain('8.01')
    expect(formatPercent(8.01, { locale: 'fr-SN' })).not.toContain('8,01')
    expect(formatNumber(1234.5, { locale: 'fr-SN', minFraction: 1 })).toBe('1,234.5')
  })
})
