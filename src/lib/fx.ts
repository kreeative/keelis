/**
 * Conversion between the currencies Keelis holds, and the spread Keelis earns on it.
 *
 * **The rates here are demonstration rates.** They are anchored to real orders of
 * magnitude so the app behaves plausibly, but they are not a market feed and no screen may
 * present them as a live quote — every surface that shows one says so. The two pegged
 * rates are the exception and are exact: XOF and XAF are fixed to the euro at 655.957 by
 * treaty, so those two numbers are facts, not estimates.
 *
 * The spread is how the product makes money on a conversion, and it is quoted *explicitly*
 * — never buried in a worse rate with no mention. Keelis's money rule is that fees are
 * stated before the user commits, and an FX spread is a fee wearing a rate's clothes.
 */
import { CURRENCIES, roundTo, type Currency } from './currency'

/** Units of each currency per 1 EUR. EUR is the base because the two pegs are to it. */
const PER_EUR: Readonly<Record<Currency, number>> = {
  EUR: 1,
  // Fixed by treaty. Not a quote, not rounded, not to be "refreshed" from a feed.
  XOF: 655.957,
  XAF: 655.957,
  USD: 1.08,
  NGN: 1700,
  ZAR: 19.8,
  EGP: 53,
  KES: 140,
  GHS: 16,
  MAD: 10.8,
  TZS: 2900,
  UGX: 4000,
  RWF: 1400,
  ETB: 125,
  DZD: 145,
  TND: 3.4,
}

/**
 * Spread taken on a conversion, as a fraction of the amount.
 *
 * Tiered the way a real desk prices risk: the two anchors are deep and cheap to hedge, a
 * leg into or out of an African currency costs more, and an African cross — which is
 * really two legs through the anchor — costs most. The pegged pair is the exception: there
 * is no rate risk to price at all, so it is charged as a transfer, not as a trade.
 */
export const SPREADS = {
  /** EUR ↔ USD. */
  anchor: 0.005,
  /** One leg between an anchor and an African currency. */
  single: 0.012,
  /** African ↔ African: two legs through the anchor. */
  cross: 0.018,
  /** XOF ↔ XAF. Same peg, no rate risk — but two central banks, so not free. */
  pegged: 0.01,
} as const

export type SpreadTier = keyof typeof SPREADS

export interface FxQuote {
  from: Currency
  to: Currency
  /** What the user hands over, in `from`. */
  amountIn: number
  /** What the user receives, in `to`, after the spread and rounded to `to`'s minor unit. */
  amountOut: number
  /** The unmarked rate: 1 `from` buys this many `to`. */
  midRate: number
  /** The rate actually applied, after the spread. */
  rate: number
  spread: number
  tier: SpreadTier
  /** The spread expressed in `from`, so it can be shown as a fee rather than a percentage. */
  feeIn: number
  /** True when the pair is fixed by treaty rather than quoted. */
  pegged: boolean
}

/** Which tier a pair falls into. Exported because the UI explains the price it charges. */
export function spreadTier(from: Currency, to: Currency): SpreadTier {
  const fromPeg = CURRENCIES[from].pegged === true
  const toPeg = CURRENCIES[to].pegged === true
  if (fromPeg && toPeg) return 'pegged'
  const fromAnchor = from === 'EUR' || from === 'USD'
  const toAnchor = to === 'EUR' || to === 'USD'
  if (fromAnchor && toAnchor) return 'anchor'
  if (fromAnchor || toAnchor) return 'single'
  return 'cross'
}

/** The unmarked rate: how many `to` one `from` buys. */
export function midRate(from: Currency, to: Currency): number {
  return PER_EUR[to] / PER_EUR[from]
}

/**
 * Price a conversion.
 *
 * The spread comes off the amount, not off the rate, and the result is rounded to the
 * destination's minor unit **once, at the end**. Rounding earlier — to whole francs before
 * applying the rate, say — loses up to a unit on every step and compounds across a
 * two-leg cross.
 */
export function quote(from: Currency, to: Currency, amountIn: number): FxQuote {
  const mid = midRate(from, to)
  if (from === to) {
    return { from, to, amountIn, amountOut: roundTo(amountIn, to), midRate: 1, rate: 1, spread: 0, tier: 'anchor', feeIn: 0, pegged: false }
  }
  const tier = spreadTier(from, to)
  const spread = SPREADS[tier]
  const rate = mid * (1 - spread)
  const safeIn = Number.isFinite(amountIn) && amountIn > 0 ? amountIn : 0
  return {
    from,
    to,
    amountIn: safeIn,
    amountOut: roundTo(safeIn * rate, to),
    midRate: mid,
    rate,
    spread,
    tier,
    feeIn: roundTo(safeIn * spread, from),
    pegged: tier === 'pegged' || CURRENCIES[from].pegged === true || CURRENCIES[to].pegged === true,
  }
}

/** Convert with no spread — for valuing a portfolio, which is not a trade. */
export function convertAtMid(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount
  return roundTo(amount * midRate(from, to), to)
}

/** Human label for why a pair costs what it costs. */
export const TIER_LABEL: Readonly<Record<SpreadTier, string>> = {
  anchor: 'Paire majeure',
  single: 'Une devise africaine',
  cross: 'Deux devises africaines',
  pegged: 'Parité fixe — même arrimage à l’euro',
}
