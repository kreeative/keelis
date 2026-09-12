import { describe, expect, it } from 'vitest'
import { maskedMoney, formatAmountInput, formatCrypto, formatDayHeading, formatMoney, formatPercent, moneyAriaLabel, parseAmountInput } from './format'

const norm = (v: string) => v.replace(/[\u202f\u00a0]/g, ' ')

const NNBSP = ' '
const NBSP = ' '

describe('formatMoney', () => {
  it('formats fr-SN with comma decimal and thin-space grouping', () => {
    // The default currency is the CFA franc, which has no centimes — so the amount rounds
    // to whole francs rather than carrying two decimals it cannot pay.
    expect(formatMoney(1234567.89, { locale: 'fr-SN' })).toBe(`1${NNBSP}234${NNBSP}568${NBSP}F${NNBSP}CFA`)
    expect(formatMoney(1234567.89, { locale: 'fr-SN', currency: 'EUR' })).toBe(`1${NNBSP}234${NNBSP}567,89${NBSP}€`)
  })
  it('formats en-NG, which puts the symbol first', () => {
    expect(formatMoney(1234.5, { locale: 'en-NG' })).toBe(`F${NNBSP}CFA${NBSP}1,235`)
    expect(formatMoney(1234.5, { locale: 'en-NG', currency: 'NGN' })).toBe('₦1,234.50')
  })
  it('adds explicit sign when requested', () => {
    expect(formatMoney(12.4, { locale: 'fr-SN', signed: true })).toBe(`+12${NBSP}F${NNBSP}CFA`)
    expect(formatMoney(-12.4, { locale: 'fr-SN', currency: 'EUR', signed: true })).toBe(`-12,40${NBSP}€`)
  })
  it('never renders negative zero', () => {
    expect(formatMoney(-0.001, { locale: 'fr-SN' })).toBe(`0${NBSP}F${NNBSP}CFA`)
  })
  it('asks each currency how many decimals it is quoted in', () => {
    // XOF has none, TND is quoted in millimes, most have two. Getting this from Intl per
    // currency rather than hardcoding 2 is the whole point.
    expect(formatMoney(1500, { locale: 'fr-SN' })).not.toContain(',')
    expect(formatMoney(1500.5, { locale: 'fr-SN', currency: 'TND' })).toContain('1 500,500'.slice(-4))
    expect(formatMoney(1500.5, { locale: 'fr-SN', currency: 'EUR' })).toContain(',50')
  })
})

describe('formatPercent', () => {
  it('signs and uses comma', () => {
    expect(formatPercent(1.4, { locale: 'fr-SN' })).toBe(`+1,4${NBSP}%`)
    expect(formatPercent(-0.86, { locale: 'fr-SN' })).toBe(`-0,86${NBSP}%`)
  })
})

describe('formatCrypto', () => {
  it('trims to sensible decimals', () => {
    expect(formatCrypto(0.0428, 'BTC', { locale: 'fr-SN' })).toBe(`0,0428${NBSP}BTC`)
    expect(formatCrypto(12.5, 'SOL', { locale: 'fr-SN' })).toBe(`12,5${NBSP}SOL`)
    expect(formatCrypto(1234.5678, undefined, { locale: 'fr-SN' })).toBe(`1${NNBSP}234,57`)
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
    expect(formatAmountInput('1234', 'fr-SN')).toBe(`1${NNBSP}234`)
    expect(formatAmountInput('1234,5', 'fr-SN')).toBe(`1${NNBSP}234,5`)
    expect(formatAmountInput('0,', 'fr-SN')).toBe('0,')
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
