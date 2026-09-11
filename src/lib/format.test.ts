import { describe, expect, it } from 'vitest'
import { maskedMoney, formatAmountInput, formatCrypto, formatDayHeading, formatMoney, formatPercent, moneyAriaLabel, parseAmountInput } from './format'

const norm = (v: string) => v.replace(/[\u202f\u00a0]/g, ' ')

const NNBSP = ' '
const NBSP = ' '

describe('formatMoney', () => {
  it('formats fr-CA with comma decimal and thin-space grouping', () => {
    expect(formatMoney(1234567.89, { locale: 'fr-CA' })).toBe(`1${NNBSP}234${NNBSP}567,89${NBSP}$`)
  })
  it('formats en-CA', () => {
    expect(formatMoney(1234.5, { locale: 'en-CA' })).toBe('$1,234.50')
  })
  it('adds explicit sign when requested', () => {
    expect(formatMoney(12.4, { locale: 'fr-CA', signed: true })).toBe(`+12,40${NBSP}$`)
    expect(formatMoney(-12.4, { locale: 'fr-CA', signed: true })).toBe(`-12,40${NBSP}$`)
  })
  it('never renders negative zero', () => {
    expect(formatMoney(-0.001, { locale: 'fr-CA' })).toBe(`0,00${NBSP}$`)
  })
})

describe('formatPercent', () => {
  it('signs and uses comma', () => {
    expect(formatPercent(1.4, { locale: 'fr-CA' })).toBe(`+1,4${NBSP}%`)
    expect(formatPercent(-0.86, { locale: 'fr-CA' })).toBe(`-0,86${NBSP}%`)
  })
})

describe('formatCrypto', () => {
  it('trims to sensible decimals', () => {
    expect(formatCrypto(0.0428, 'BTC', { locale: 'fr-CA' })).toBe(`0,0428${NBSP}BTC`)
    expect(formatCrypto(12.5, 'SOL', { locale: 'fr-CA' })).toBe(`12,5${NBSP}SOL`)
    expect(formatCrypto(1234.5678, undefined, { locale: 'fr-CA' })).toBe(`1${NNBSP}234,57`)
  })
})

describe('amount input', () => {
  it('parses comma and dot decimals', () => {
    expect(parseAmountInput('1234,56')).toBe(1234.56)
    expect(parseAmountInput('1234.56')).toBe(1234.56)
    expect(parseAmountInput('')).toBe(0)
  })
  it('formats while typing', () => {
    expect(formatAmountInput('', 'fr-CA')).toBe('0')
    expect(formatAmountInput('1234', 'fr-CA')).toBe(`1${NNBSP}234`)
    expect(formatAmountInput('1234,5', 'fr-CA')).toBe(`1${NNBSP}234,5`)
    expect(formatAmountInput('0,', 'fr-CA')).toBe('0,')
    expect(formatAmountInput('1234,5', 'en-CA')).toBe('1,234.5')
  })
})

describe('dates', () => {
  it('uses Aujourd’hui / Hier headings', () => {
    const now = new Date(2026, 8, 10, 15)
    expect(formatDayHeading(new Date(2026, 8, 10, 8), { locale: 'fr-CA', now })).toBe("Aujourd'hui")
    expect(formatDayHeading(new Date(2026, 8, 9, 23), { locale: 'fr-CA', now })).toBe('Hier')
    expect(formatDayHeading(new Date(2026, 8, 1, 12), { locale: 'fr-CA', now })).toMatch(/^Mardi 1 septembre$/)
  })
})

describe('a11y', () => {
  it('produces a long-form label', () => {
    expect(moneyAriaLabel(1234.56, { locale: 'fr-CA' })).toMatch(/dollars canadiens/)
  })
})

describe('maskedMoney', () => {
  it('keeps the currency symbol on the side the locale puts it', () => {
    expect(norm(maskedMoney({ locale: 'fr-CA' }))).toBe('••••• $')
    expect(norm(maskedMoney({ locale: 'en-CA' }))).toBe('$•••••')
  })
})
