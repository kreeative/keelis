/**
 * Localised formatting. fr-SN by default, en-NG optional.
 * - decimal separator: comma (fr-SN) / period (en-NG)
 * - thousands separator: narrow no-break space (U+202F) in fr-SN
 * - all amount strings are tabular-nums friendly (no letters inside numbers)
 */
import { CURRENCIES, type Currency } from './currency'

export type Locale = 'fr-SN' | 'en-NG'

/**
 * The currency an amount is in when nothing says otherwise. Keewal Meere is West-Africa-first,
 * so that is the CFA franc — and because XOF has no centimes, this default alone changes
 * how every bare amount in the app is punctuated.
 */
export const DEFAULT_CURRENCY: Currency = 'XOF'

/**
 * How many decimals a currency is actually quoted in. XOF and XAF have none, TND has
 * three, most have two. `Intl` is the authority and the registry mirrors it (there is a
 * test pinning the two together), so an unknown code falls back to two rather than
 * guessing.
 */
function minorUnits(code: string): number {
  return CURRENCIES[code as Currency]?.decimals ?? 2
}

const NBSP = ' '

let currentLocale: Locale = 'fr-SN'
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

/**
 * Join formatted parts with **one** number punctuation for the whole app: comma for
 * thousands, point for decimals — "107,223.11" — whichever language the interface is in.
 *
 * This deliberately overrides French typography, which would group with a thin space and
 * decimate with a comma. It is the owner's call, and it is the convention most African
 * fintech apps and every price feed already use, so a figure reads the same on the screen
 * as in the statement someone compares it against. The *words* stay French; only the
 * punctuation of the digits is fixed.
 */
/**
 * The space *inside* a multi-word symbol, widened.
 *
 * `Intl` gives XOF's symbol as « F CFA » with U+202F between the words — a narrow no-break
 * space, about a sixth of an em. That is correct French typography and it is invisible
 * here, because money in this app is tracked in at `--ls-numeric` (−0.035em), and the
 * tracking applies to that space like any other character. Measured on the home screen's
 * hero at 40.7px: the symbol with its narrow space is 31.23px wide and « FCFA » with no
 * space at all is 31.14px. Nine hundredths of a pixel. It was rendering as one word.
 *
 * So either the tracking is wrong or the space has to be wider, and the tracking is a
 * measured decision about *digits* — display-size counters carry themselves. A currency
 * name is letters. It takes an ordinary no-break space, which survives the tracking with
 * about two pixels left, which is what it is for. This is the same call the app already
 * makes on the group separator and the decimal mark: `Intl` says what the locale does, and
 * the app decides what is legible on its own screens.
 */
function widenSymbol(value: string): string {
  return value.replace(/\u202f/g, NBSP)
}

function joinParts(parts: Intl.NumberFormatPart[], _locale: Locale): string {
  return parts
    .map((p) => {
      if (p.type === 'group') return ','
      if (p.type === 'decimal') return '.'
      if (p.type === 'literal' && (p.value === ' ' || p.value === NBSP)) return NBSP
      if (p.type === 'currency') return widenSymbol(p.value)
      return p.value
    })
    .join('')
}

export interface MoneyOptions {
  locale?: Locale
  currency?: string
  /** Show explicit sign for positive values */
  signed?: boolean
  /** Keep the cents on a whole number — "2,00 $" rather than "2 $". Off by default:
      ",00" carries no information, and a dozen call sites were already opting out of it
      one at a time before this became the default. */
  alwaysCents?: boolean
  /** Max fraction digits override */
  maxFraction?: number
  /**
   * Abbreviate a large figure — « 24.3M F CFA » — once it is too long for the space it has.
   *
   * Only above `COMPACT_FROM`: below that the exact figure fits, and « 116.3 » in place of
   * « 116.34 » would be a rounding nobody asked for. The suffixes come from `Intl`, so they
   * are the locale's own — k / M / Md in French, K / M / B in English — rather than a table
   * this file would have to keep for sixteen currencies.
   *
   * **Truncated, never rounded.** 1,999,999 F CFA rounds half-up to « 2 M », which claims a
   * million the account does not hold; it truncates to « 1.9 M », which is true. A balance
   * may be less precise than the ledger, never larger.
   */
  compact?: boolean
}

/**
 * How long a figure may be before it is abbreviated — in characters, not in money.
 *
 * A value threshold would be wrong in both directions: ten million francs is an ordinary
 * balance and ten million euros is not, and the thing that actually breaks is the *string*
 * running out of room.
 *
 * Measured on the account row at 320px, the narrowest the app supports: the row is 254px,
 * the widest account name 66px and the gap 16px, so the amount has **172px**, and a figure
 * there runs about 8.75px a character. Nineteen characters fit and twenty do not; eighteen
 * is the budget, which leaves the name 90px rather than shaving the last six pixels.
 *
 * That is deliberately generous, and the owner asked for it to be: **if a figure fits, it is
 * shown in full, millions included.** Eighteen characters covers every balance below a
 * billion francs — « 13,545,512 F CFA » is sixteen and stays exact. It was fifteen, from a
 * first estimate of « about 170px » that guessed the per-character width instead of measuring
 * it, and that abbreviated figures with thirty pixels of room to spare.
 */
export const COMPACT_MAX_CHARS = 18

const COMPACT_OPTIONS: Intl.NumberFormatOptions = { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1, roundingMode: 'trunc', minimumFractionDigits: 0 }

/** Format a fiat amount, e.g. 1 234,56 $ (fr-SN) or $1,234.56 (en-NG). */
export function formatMoney(value: number, opts: MoneyOptions = {}): string {
  const locale = opts.locale ?? currentLocale
  const currency = opts.currency ?? DEFAULT_CURRENCY
  const units = minorUnits(currency)
  // Decide on the value actually rendered, not the one passed in: a tiny negative is
  // clamped to zero below, and testing the raw -0.001 for integer-ness would print it as
  // "0,00 $" while a true zero printed "0 $". The threshold is half of the currency's own
  // smallest unit, so it is half a franc for XOF and half a centime for EUR.
  const epsilon = 0.5 / 10 ** units
  const shown = Math.abs(value) < epsilon && !opts.signed ? 0 : value
  const minimumFractionDigits = !opts.alwaysCents && Number.isInteger(shown) ? 0 : units
  const base: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits,
    maximumFractionDigits: opts.maxFraction ?? units,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }
  const plain = joinParts(numberFormat(locale, base).formatToParts(shown), locale)
  if (!opts.compact || plain.length <= COMPACT_MAX_CHARS) return plain
  // `minimumFractionDigits` is overridden by the compact options: a minimum of 2 alongside
  // them would print « 2,70 M ».
  const f = numberFormat(locale, { ...base, ...COMPACT_OPTIONS })
  return joinParts(f.formatToParts(shown), locale)
}

/**
 * Split a formatted amount into its digits and its currency symbol, so a screen can set
 * the symbol as part of the figure rather than as an annotation.
 *
 * Done through `formatToParts` rather than by stripping a known string: the symbol is "F CFA"
 * for XOF, "₦" for NGN, "GH₵" for GHS and "€" for EUR, it sits before the digits in some
 * locales and after in others, and the old code compared the currency code to 'CAD' and
 * assumed "$". `prefix` says which side the locale puts it on.
 */
export function splitMoney(value: number, opts: MoneyOptions = {}): { number: string; symbol: string; prefix: boolean } {
  const locale = opts.locale ?? currentLocale
  const currency = opts.currency ?? DEFAULT_CURRENCY
  const units = minorUnits(currency)
  const epsilon = 0.5 / 10 ** units
  const shown = Math.abs(value) < epsilon && !opts.signed ? 0 : value
  const base: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: !opts.alwaysCents && Number.isInteger(shown) ? 0 : units,
    maximumFractionDigits: opts.maxFraction ?? units,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }
  // The same decision as formatMoney, taken on the same string, so the two cannot disagree.
  const tooLong = joinParts(numberFormat(locale, base).formatToParts(shown), locale).length > COMPACT_MAX_CHARS
  const f = numberFormat(locale, opts.compact && tooLong ? { ...base, ...COMPACT_OPTIONS } : base)
  const parts = f.formatToParts(shown)
  const symbolIndex = parts.findIndex((p) => p.type === 'currency')
  const symbol = symbolIndex >= 0 ? widenSymbol(parts[symbolIndex]!.value) : ''
  /* Only the space *next to the symbol* goes: that one is the gap this function exists to
     own, since the caller sets the symbol beside the digits itself. Other literals belong to
     the number — French writes « 24,3 M » with a space before the compact suffix, and
     stripping every literal turned that into « 24,3M » while `formatMoney` kept the space. */
  const isGap = (p: Intl.NumberFormatPart) => p.type === 'literal' && (p.value === ' ' || p.value === NBSP)
  const rest = parts.filter((p, i) => i !== symbolIndex && !(isGap(p) && (i === symbolIndex - 1 || i === symbolIndex + 1)))
  return { number: joinParts(rest, locale).trim(), symbol, prefix: symbolIndex === 0 }
}

/**
 * Two amounts in the same currency written as a pair — « 1,850,000 / 3,000,000 F CFA ».
 *
 * The currency is stated **once**, on the side the locale puts it: a suffix locale closes
 * the pair with it, a prefix locale opens with it. Repeating it says the same word twice
 * about the same money, and it is not free. Measured on the savings goal card in the 340px
 * desktop aside: « 1,850,000 F CFA / 3,000,000 F CFA » takes 210px of the 328px line, and
 * the 38px the second « F CFA » spends comes out of the goal's *name* — the one thing on
 * that card the person wrote themselves. « Fonds d’urgence » rendered as « Fonds d’… ».
 *
 * Both sides go through the ordinary formatters — `formatMoney` for the side that keeps
 * the symbol, `splitMoney` for the bare digits — so a pair cannot punctuate itself
 * differently from every other figure on the screen.
 */
export function moneyPair(a: number, b: number, hidden: boolean, opts: MoneyOptions = {}): { first: string; second: string } {
  const { prefix } = splitMoney(0, opts)
  if (hidden) return prefix ? { first: maskedMoney(opts), second: MASKED } : { first: MASKED, second: maskedMoney(opts) }
  return prefix
    ? { first: formatMoney(a, opts), second: splitMoney(b, opts).number }
    : { first: splitMoney(a, opts).number, second: formatMoney(b, opts) }
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
export function formatPercent(value: number, opts: { locale?: Locale; signed?: boolean; maxFraction?: number; minFraction?: number } = {}): string {
  const locale = opts.locale ?? currentLocale
  const minimumFractionDigits = opts.minFraction ?? 1
  const f = numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits: Math.max(minimumFractionDigits, opts.maxFraction ?? 2),
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

/** « avril 2027 » — month + year, capitalised. */
export function formatMonthYear(d: Date | string | number, opts: { locale?: Locale } = {}): string {
  const locale = opts.locale ?? currentLocale
  const s = dateFormat(locale, { month: 'long', year: 'numeric' }).format(toDate(d))
  return s.charAt(0).toUpperCase() + s.slice(1)
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
  if (diffDays === 0) return locale === 'fr-SN' ? "Aujourd'hui" : 'Today'
  if (diffDays === 1) return locale === 'fr-SN' ? 'Hier' : 'Yesterday'
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
  if (min < 1) return locale === 'fr-SN' ? "à l'instant" : 'just now'
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
  const currency = opts.currency ?? DEFAULT_CURRENCY
  const f = numberFormat(locale, { style: 'currency', currency, currencyDisplay: 'name', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return f.format(value)
}

export function percentAriaLabel(value: number, opts: { locale?: Locale } = {}): string {
  const locale = opts.locale ?? currentLocale
  const dir = value > 0 ? (locale === 'fr-SN' ? 'en hausse de' : 'up') : value < 0 ? (locale === 'fr-SN' ? 'en baisse de' : 'down') : locale === 'fr-SN' ? 'stable' : 'flat'
  if (value === 0) return dir
  const p = numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Math.abs(value))
  return `${dir} ${p} ${locale === 'fr-SN' ? 'pour cent' : 'percent'}`
}

/** Mask a balance for privacy mode */
export const MASKED = '•••••'

/**
 * A masked balance that keeps its currency symbol, and keeps it on the side the locale
 * puts it — « ••••• $ » in fr-SN, « $••••• » in en-NG. The reference kit masks this way
 * rather than dropping the symbol, which leaves the row unreadable as money.
 */
export function maskedMoney(opts: { locale?: Locale; currency?: string } = {}): string {
  const locale = opts.locale ?? currentLocale
  const parts = numberFormat(locale, {
    style: 'currency',
    currency: opts.currency ?? DEFAULT_CURRENCY,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0)
  return parts
    .map((p) => {
      if (p.type === 'currency') return p.value
      if (p.type === 'literal') return NBSP
      if (p.type === 'integer') return MASKED
      return ''
    })
    .join('')
}

/**
 * An amount written inside a sentence or caption, where <Money> cannot be used.
 * Respects the privacy mask like the component does.
 */
export function inlineMoney(value: number, hidden: boolean, opts: MoneyOptions = {}): string {
  return hidden ? MASKED : formatMoney(value, opts)
}

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
  // One decimal mark app-wide, same as joinParts.
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`
}

/**
 * « 4,00 % » — the savings rate, always to two decimals.
 *
 * Here rather than in `features/savings/` because two screens show it now, and the one that
 * did not — the account row on Accueil — was writing « 4.0 % » with `formatPercent` while the
 * savings page wrote « 4,00 % ». The same rate, two ways, on two screens a tap apart.
 *
 * It is written « … par an » wherever it appears, never « APY ». That acronym is American,
 * means nothing to somebody reading French in Dakar, and is the wrong word besides: it
 * promises a *compounded* yield, while what this pays is a simple daily rate on the balance,
 * credited monthly. Saying « 4,00 % par an » needs no glossary and happens to be true.
 */
export function formatRate(rate: number, locale?: Locale): string {
  return `${formatNumber(rate, { locale: locale ?? currentLocale, minFraction: 2, maxFraction: 2 })}${NBSP}%`
}
