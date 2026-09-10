/**
 * Localised formatting. fr-CA by default, en-CA optional.
 * - decimal separator: comma (fr-CA) / period (en-CA)
 * - thousands separator: narrow no-break space (U+202F) in fr-CA
 * - all amount strings are tabular-nums friendly (no letters inside numbers)
 */
export type Locale = 'fr-CA' | 'en-CA'

const NNBSP = ' '
const NBSP = ' '

let currentLocale: Locale = 'fr-CA'
export function setFormatLocale(locale: Locale) {
  currentLocale = locale
}
export function getFormatLocale(): Locale {
  return currentLocale
}

const fmtCache = new Map<string, Intl.NumberFormat>()
function numberFormat(locale: Locale, options: Intl.NumberFormatOptions) {
  const key = locale + JSON.stringify(options)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, options)
    fmtCache.set(key, f)
  }
  return f
}

/** Join formatted parts, normalising group separators to a thin space in French. */
function joinParts(parts: Intl.NumberFormatPart[], locale: Locale): string {
  return parts
    .map((p) => {
      if (p.type === 'group') return locale === 'fr-CA' ? NNBSP : ','
      if (p.type === 'literal' && (p.value === ' ' || p.value === NBSP)) return NBSP
      return p.value
    })
    .join('')
}

export interface MoneyOptions {
  locale?: Locale
  currency?: string
  /** Show explicit sign for positive values */
  signed?: boolean
  /** Hide the cents when the value is a whole number (default false) */
  compactCents?: boolean
  /** Max fraction digits override */
  maxFraction?: number
}

/** Format a fiat amount, e.g. 1 234,56 $ (fr-CA) or $1,234.56 (en-CA). */
export function formatMoney(value: number, opts: MoneyOptions = {}): string {
  const locale = opts.locale ?? currentLocale
  const currency = opts.currency ?? 'CAD'
  const minimumFractionDigits = opts.compactCents && Number.isInteger(value) ? 0 : 2
  const f = numberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits,
    maximumFractionDigits: opts.maxFraction ?? 2,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  })
  const abs = Math.abs(value) < 0.005 && !opts.signed ? 0 : value
  return joinParts(f.formatToParts(abs), locale)
}

/** Plain number, e.g. 12 345,6 */
export function formatNumber(value: number, opts: { locale?: Locale; maxFraction?: number; minFraction?: number; signed?: boolean } = {}): string {
  const locale = opts.locale ?? currentLocale
  const f = numberFormat(locale, {
    minimumFractionDigits: opts.minFraction ?? 0,
    maximumFractionDigits: opts.maxFraction ?? 2,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  })
  return joinParts(f.formatToParts(value), locale)
}

/** Crypto quantity: up to 8 decimals, trailing zeros trimmed, min 2 shown for readability. */
export function formatCrypto(quantity: number, symbol?: string, opts: { locale?: Locale; maxFraction?: number } = {}): string {
  const locale = opts.locale ?? currentLocale
  const max = opts.maxFraction ?? (Math.abs(quantity) >= 1000 ? 2 : Math.abs(quantity) >= 1 ? 4 : 8)
  const f = numberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: max })
  const n = joinParts(f.formatToParts(quantity), locale)
  return symbol ? `${n}${NBSP}${symbol}` : n
}

/** Percent with sign, e.g. +1,4 % */
export function formatPercent(value: number, opts: { locale?: Locale; signed?: boolean; maxFraction?: number } = {}): string {
  const locale = opts.locale ?? currentLocale
  const f = numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: opts.maxFraction ?? 2,
    signDisplay: opts.signed === false ? 'auto' : 'exceptZero',
  })
  return joinParts(f.formatToParts(value / 100), locale)
}

/** Delta line under an amount: "+12,40 $ · +1,4 %" */
export function formatDelta(amount: number, percent: number, opts: { locale?: Locale; suffix?: string } = {}): string {
  const parts = [formatMoney(amount, { locale: opts.locale, signed: true }), formatPercent(percent, { locale: opts.locale })]
  if (opts.suffix) parts.push(opts.suffix)
  return parts.join(` · `)
}

// ---------- Dates ----------

const dtCache = new Map<string, Intl.DateTimeFormat>()
function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options)
  let f = dtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options)
    dtCache.set(key, f)
  }
  return f
}

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d)
}

/** 10 sept. 2026 */
export function formatDate(d: Date | string | number, opts: { locale?: Locale; style?: 'short' | 'medium' | 'long' } = {}): string {
  const locale = opts.locale ?? currentLocale
  return dateFormat(locale, { dateStyle: opts.style ?? 'medium' }).format(toDate(d))
}

/** 10 sept. 2026, 14:32 */
export function formatDateTime(d: Date | string | number, opts: { locale?: Locale } = {}): string {
  const locale = opts.locale ?? currentLocale
  return dateFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(d))
}

/** 14:32 */
export function formatTime(d: Date | string | number, opts: { locale?: Locale } = {}): string {
  const locale = opts.locale ?? currentLocale
  return dateFormat(locale, { timeStyle: 'short' }).format(toDate(d))
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Day heading for grouped lists: "Aujourd'hui", "Hier", else "mardi 8 septembre". */
export function formatDayHeading(d: Date | string | number, opts: { locale?: Locale; now?: Date } = {}): string {
  const locale = opts.locale ?? currentLocale
  const date = toDate(d)
  const now = opts.now ?? new Date()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return locale === 'fr-CA' ? "Aujourd'hui" : 'Today'
  if (diffDays === 1) return locale === 'fr-CA' ? 'Hier' : 'Yesterday'
  const sameYear = date.getFullYear() === now.getFullYear()
  const s = dateFormat(locale, sameYear ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Relative: "il y a 3 min", "il y a 2 h", "hier", else short date */
export function formatRelative(d: Date | string | number, opts: { locale?: Locale; now?: Date } = {}): string {
  const locale = opts.locale ?? currentLocale
  const date = toDate(d)
  const now = opts.now ?? new Date()
  const diff = Math.max(0, now.getTime() - date.getTime())
  const min = Math.round(diff / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (min < 1) return locale === 'fr-CA' ? "à l'instant" : 'just now'
  if (min < 60) return rtf.format(-min, 'minute')
  const h = Math.round(min / 60)
  if (h < 24) return rtf.format(-h, 'hour')
  const days = Math.round(h / 24)
  if (days < 7) return rtf.format(-days, 'day')
  return formatDate(date, { locale, style: 'medium' })
}

/** Day key for grouping: YYYY-MM-DD in local time */
export function dayKey(d: Date | string | number): string {
  const date = toDate(d)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

// ---------- Accessibility ----------

/** Long-form amount for screen readers: "1 234 dollars et 56 cents" */
export function moneyAriaLabel(value: number, opts: { locale?: Locale; currency?: string } = {}): string {
  const locale = opts.locale ?? currentLocale
  const currency = opts.currency ?? 'CAD'
  const f = numberFormat(locale, { style: 'currency', currency, currencyDisplay: 'name', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return f.format(value)
}

export function percentAriaLabel(value: number, opts: { locale?: Locale } = {}): string {
  const locale = opts.locale ?? currentLocale
  const dir = value > 0 ? (locale === 'fr-CA' ? 'en hausse de' : 'up') : value < 0 ? (locale === 'fr-CA' ? 'en baisse de' : 'down') : locale === 'fr-CA' ? 'stable' : 'flat'
  if (value === 0) return dir
  const p = numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Math.abs(value))
  return `${dir} ${p} ${locale === 'fr-CA' ? 'pour cent' : 'percent'}`
}

/** Mask a balance for privacy mode */
export const MASKED = '••••'

/** Parse a keypad string ("1234,56") into a number regardless of locale separator. */
export function parseAmountInput(raw: string): number {
  if (!raw) return 0
  const normalised = raw.replace(/[\s  ]/g, '').replace(',', '.')
  const n = Number(normalised)
  return Number.isFinite(n) ? n : 0
}

/** Display a keypad string with the locale decimal separator and thin-space grouping while typing. */
export function formatAmountInput(raw: string, locale: Locale = currentLocale): string {
  if (!raw) return '0'
  const [intPart = '', fracPart] = raw.replace('.', ',').split(',')
  const intNum = intPart === '' ? '0' : intPart
  const grouped = joinParts(numberFormat(locale, { maximumFractionDigits: 0, useGrouping: true }).formatToParts(Number(intNum)), locale)
  const sep = locale === 'fr-CA' ? ',' : '.'
  return fracPart === undefined ? grouped : `${grouped}${sep}${fracPart}`
}
