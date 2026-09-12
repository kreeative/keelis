/**
 * The currencies Keelis holds, quotes and converts.
 *
 * Two facts drive everything in this file, and both are law rather than opinion:
 *
 * 1. **Not every currency has cents.** XOF, XAF, UGX and RWF are quoted in whole units —
 *    there are no centimes in circulation — and TND is quoted in *three* decimals
 *    (millimes). Forcing two everywhere, which this app did while it was Canadian, prints
 *    "1 500,00 F CFA" for a sum that cannot have a fractional part. `Intl` already knows
 *    the right number for every code here, so nothing in this file hardcodes it: the
 *    formatter asks the currency. `decimals` below is only for arithmetic that has to
 *    round before a rate is applied.
 *
 * 2. **XOF and XAF are pegged to the euro at exactly 655.957**, fixed by treaty, not
 *    floated on a market. A quote on that pair is not a price discovery — it is a
 *    constant, and the only variable is the spread. `fx.ts` treats it that way.
 *
 * A practical caveat the peg hides: XOF (BCEAO, West Africa) and XAF (BEAC, Central
 * Africa) share the same peg, so they are 1:1 with each other — but they are issued by two
 * different central banks and are not freely interchangeable between the zones. The rate
 * is trivial; the settlement is not.
 */

export type Currency =
  | 'XOF'
  | 'XAF'
  | 'NGN'
  | 'ZAR'
  | 'EGP'
  | 'KES'
  | 'GHS'
  | 'MAD'
  | 'TZS'
  | 'UGX'
  | 'RWF'
  | 'ETB'
  | 'DZD'
  | 'TND'
  | 'EUR'
  | 'USD'

export interface CurrencyInfo {
  code: Currency
  /** French name, as it appears in the UI. */
  name: string
  /** Where it is legal tender — shown under the name in the picker. */
  zone: string
  /** Minor units. Only for rounding before arithmetic; display asks `Intl`. */
  decimals: 0 | 2 | 3
  /** Fixed to the euro by treaty rather than floated. */
  pegged?: boolean
}

export const CURRENCIES: Readonly<Record<Currency, CurrencyInfo>> = {
  XOF: { code: 'XOF', name: 'Franc CFA', zone: 'UEMOA — Sénégal, Côte d’Ivoire, Mali, Bénin…', decimals: 0, pegged: true },
  XAF: { code: 'XAF', name: 'Franc CFA', zone: 'CEMAC — Cameroun, Gabon, Tchad, Congo…', decimals: 0, pegged: true },
  NGN: { code: 'NGN', name: 'Naira', zone: 'Nigeria', decimals: 2 },
  ZAR: { code: 'ZAR', name: 'Rand', zone: 'Afrique du Sud', decimals: 2 },
  EGP: { code: 'EGP', name: 'Livre égyptienne', zone: 'Égypte', decimals: 2 },
  KES: { code: 'KES', name: 'Shilling kényan', zone: 'Kenya', decimals: 2 },
  GHS: { code: 'GHS', name: 'Cedi', zone: 'Ghana', decimals: 2 },
  MAD: { code: 'MAD', name: 'Dirham marocain', zone: 'Maroc', decimals: 2 },
  TZS: { code: 'TZS', name: 'Shilling tanzanien', zone: 'Tanzanie', decimals: 2 },
  UGX: { code: 'UGX', name: 'Shilling ougandais', zone: 'Ouganda', decimals: 0 },
  RWF: { code: 'RWF', name: 'Franc rwandais', zone: 'Rwanda', decimals: 0 },
  ETB: { code: 'ETB', name: 'Birr', zone: 'Éthiopie', decimals: 2 },
  DZD: { code: 'DZD', name: 'Dinar algérien', zone: 'Algérie', decimals: 2 },
  TND: { code: 'TND', name: 'Dinar tunisien', zone: 'Tunisie', decimals: 3 },
  EUR: { code: 'EUR', name: 'Euro', zone: 'Zone euro', decimals: 2 },
  USD: { code: 'USD', name: 'Dollar américain', zone: 'États-Unis', decimals: 2 },
}

/** Display order: the home zone first, then the rest of Africa, then the two anchors. */
export const CURRENCY_ORDER: readonly Currency[] = [
  'XOF',
  'XAF',
  'NGN',
  'GHS',
  'KES',
  'TZS',
  'UGX',
  'RWF',
  'ETB',
  'ZAR',
  'EGP',
  'MAD',
  'DZD',
  'TND',
  'EUR',
  'USD',
]

/** The two currencies that are not African, kept apart because pricing treats them so. */
export const ANCHOR_CURRENCIES: readonly Currency[] = ['EUR', 'USD']

export function isCurrency(v: string): v is Currency {
  return v in CURRENCIES
}

export function currencyInfo(code: Currency): CurrencyInfo {
  return CURRENCIES[code]
}

export function isAfrican(code: Currency): boolean {
  return !ANCHOR_CURRENCIES.includes(code)
}

/**
 * Round to the currency's own minor unit.
 *
 * This has to happen at the *end* of a conversion, never in the middle: rounding XOF to
 * whole francs before applying a rate loses up to a franc per step, and a multi-step
 * conversion would compound it.
 */
export function roundTo(amount: number, code: Currency): number {
  const f = 10 ** CURRENCIES[code].decimals
  return Math.round(amount * f) / f
}
