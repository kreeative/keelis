import { describe, expect, it } from 'vitest'
import { MASKED, maskedMoney, formatAmountInput, formatCrypto, formatDayHeading, formatMoney, formatNumber, formatPercent, moneyAriaLabel, moneyPair, parseAmountInput, splitMoney } from './format'

const norm = (v: string) => v.replace(/[\u202f\u00a0]/g, ' ')

const NBSP = ' '

/* The space inside « F CFA ».
 *
 * `Intl` puts U+202F there — a narrow no-break space, correct French typography and, on
 * this app's screens, invisible: money is tracked in at −0.035em and the tracking eats it.
 * Measured on the home hero at 40.7px, the symbol with its narrow space is 31.23px and
 * « FCFA » with no space at all is 31.14px. `widenSymbol` swaps it for an ordinary no-break
 * space, which survives the tracking with about two pixels left.
 *
 * This constant is therefore NBSP and must stay NBSP — it is the assertion, not a detail. */
const SYMSP = NBSP

describe('formatMoney', () => {
  it('punctuates digits the same way in every locale: comma groups, point decimates', () => {
    // Deliberately not French typography. One punctuation app-wide, so a figure reads the
    // same here as on the statement someone compares it against.
    expect(formatMoney(1234567.89, { locale: 'fr-SN' })).toBe(`1,234,568${NBSP}F${SYMSP}CFA`)
    expect(formatMoney(1234567.89, { locale: 'fr-SN', currency: 'EUR' })).toBe(`1,234,567.89${NBSP}€`)
    // The CFA franc has no centimes, so the amount rounds to whole francs above.
  })
  it('formats en-NG, which puts the symbol first', () => {
    expect(formatMoney(1234.5, { locale: 'en-NG' })).toBe(`F${SYMSP}CFA${NBSP}1,235`)
    expect(formatMoney(1234.5, { locale: 'en-NG', currency: 'NGN' })).toBe('₦1,234.50')
  })
  it('adds explicit sign when requested', () => {
    expect(formatMoney(12.4, { locale: 'fr-SN', signed: true })).toBe(`+12${NBSP}F${SYMSP}CFA`)
    expect(formatMoney(-12.4, { locale: 'fr-SN', currency: 'EUR', signed: true })).toBe(`-12.40${NBSP}€`)
  })
  it('never renders negative zero', () => {
    expect(formatMoney(-0.001, { locale: 'fr-SN' })).toBe(`0${NBSP}F${SYMSP}CFA`)
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

describe('compact money', () => {
  /* The gaps are real characters and they matter: `joinParts` emits a no-break space
     between the figure and its suffix, and « F CFA » carries one inside itself. A literal
     typed with the space on a keyboard matches neither. */
  const NB = '\u00a0'
  const FCFA = `F${SYMSP}CFA`
  const xof = (v: number, locale: 'fr-SN' | 'en-NG' = 'fr-SN') => formatMoney(v, { locale, currency: 'XOF', compact: true })

  it('abbreviates on length, not on value', () => {
    /* The rule is about the string running out of room, not about passing a round figure:
       ten million francs is an ordinary balance and ten million euros is not. */
    const plain = (v: number) => formatMoney(v, { locale: 'fr-SN', currency: 'XOF' })
    expect(plain(999_999_999)).toHaveLength(17)
    expect(plain(12_345_678_901)).toHaveLength(20)
  })

  it('shows millions in full, because they fit', () => {
    /* The owner's rule: if there is room, print the figure. The budget is eighteen
       characters, measured on the 320px row — everything below a billion francs stays
       exact. It was fifteen, from an estimate that guessed the per-character width instead
       of measuring it, and abbreviated figures with thirty pixels to spare. */
    const plain = (v: number) => formatMoney(v, { locale: 'fr-SN', currency: 'XOF' })
    for (const v of [2_766_500, 8_290_000, 13_545_512, 24_325_824, 999_999_999]) {
      expect(xof(v), `${v} should be printed in full`).toBe(plain(v))
    }
  })

  it('abbreviates once it genuinely will not fit', () => {
    expect(xof(12_345_678_901)).toBe(`12.3${NB}Md${NB}${FCFA}`)
  })

  it('leaves a figure that fits exactly alone', () => {
    expect(xof(999_999)).toBe(formatMoney(999_999, { locale: 'fr-SN', currency: 'XOF' }))
    // And it never invents a rounding: « 116,3 » for 116,34 is a precision loss nobody asked for.
    expect(formatMoney(1240.5, { locale: 'fr-SN', currency: 'EUR', compact: true })).toBe(`1,240.50${NB}€`)
    expect(formatMoney(116.34, { locale: 'fr-SN', currency: 'EUR', compact: true })).toBe(`116.34${NB}€`)
  })

  it('truncates rather than rounds, because a balance may not claim money it does not hold', () => {
    // Half-up would print « 20 Md » for this, which is money the account does not have.
    expect(xof(19_999_999_999)).toBe(`19.9${NB}Md${NB}${FCFA}`)
  })

  it('takes its suffixes from the locale rather than a table', () => {
    expect(xof(15_000_000_000)).toBe(`15${NB}Md${NB}${FCFA}`)
    expect(xof(15_000_000_000, 'en-NG')).toBe(`${FCFA}${NB}15B`)
  })

  it('keeps the app’s punctuation: comma groups, point decimal', () => {
    // The French locale would write « 12,3 Md » — the app's rule overrides that everywhere.
    expect(xof(12_345_678_901)).toBe(`12.3${NB}Md${NB}${FCFA}`)
  })

  it('splits the same way it formats', () => {
    // These two drifted: splitMoney stripped every space literal, so the compact suffix lost
    // the gap that formatMoney kept.
    const split = splitMoney(12_345_678_901, { locale: 'fr-SN', currency: 'XOF', compact: true })
    expect(split.number).toBe(`12.3${NB}Md`)
    expect(`${split.number}${NB}${split.symbol}`).toBe(xof(12_345_678_901))
  })

  it('carries the sign on a negative', () => {
    expect(xof(-12_345_678_901)).toContain(`12.3${NB}Md`)
    expect(xof(-12_345_678_901).startsWith('-')).toBe(true)
  })
})

describe('moneyPair', () => {
  it('writes the currency once, at the end, where the locale puts it at the end', () => {
    const { first, second } = moneyPair(1_850_000, 3_000_000, false, { locale: 'fr-SN', currency: 'XOF' })
    expect(first).toBe('1,850,000')
    expect(second).toBe(formatMoney(3_000_000, { locale: 'fr-SN', currency: 'XOF' }))
    // and never twice — this is the whole point of the helper
    expect(`${first} / ${second}`.match(/CFA/g)?.length).toBe(1)
  })

  it('writes it once at the *front* where the locale puts it at the front', () => {
    const { first, second } = moneyPair(1_850_000, 3_000_000, false, { locale: 'en-NG', currency: 'NGN' })
    expect(first).toBe(formatMoney(1_850_000, { locale: 'en-NG', currency: 'NGN' }))
    expect(first.startsWith('\u20a6')).toBe(true)
    expect(second).toBe('3,000,000')
  })

  it('keeps the symbol on exactly one side when masked, too', () => {
    const { first, second } = moneyPair(1, 2, true, { locale: 'fr-SN', currency: 'XOF' })
    expect(first).toBe(MASKED)
    expect(second).toBe(maskedMoney({ locale: 'fr-SN', currency: 'XOF' }))
  })
})
