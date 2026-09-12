/**
 * The hero number. Amount in `display`, currency in `h2` on the same baseline,
 * optional delta line below ("+12,40 $ · +1,4 % · 24 h").
 */
import { DEFAULT_CURRENCY, MASKED, formatMoney, formatNumber, formatPercent, moneyAriaLabel, percentAriaLabel, splitMoney } from '@/lib/format'
import { useSettings } from '@/store/settings'
import { cn } from '@/lib/cn'
import { SkeletonAmount } from './Skeleton'
import styles from './AmountDisplay.module.css'

export interface AmountDisplayProps {
  value: number | undefined
  currency?: string
  /** Delta in fiat */
  delta?: number
  /** Delta in percent */
  deltaPct?: number
  /** e.g. "24 h", "Aujourd'hui" */
  period?: string
  /** Extra line under the delta */
  caption?: string
  /** Show a quantity with its unit instead of a currency, e.g. "0,0428 BTC" */
  unit?: string
  /** Decimals when `unit` is set (crypto quantities). Default 8. */
  maxFraction?: number
  /** Prefix an explicit sign ("+2 184,50 $") */
  signed?: boolean
  /** Colour the amount by sign */
  tone?: boolean
  size?: 'display' | 'h1'
  loading?: boolean
  align?: 'start' | 'center'
  className?: string
  /** Ignore privacy mask */
  unmasked?: boolean
}

export function AmountDisplay({ value, currency = DEFAULT_CURRENCY, delta, deltaPct, period, caption, unit, maxFraction, signed = false, tone = false, size = 'display', loading, align = 'start', className, unmasked }: AmountDisplayProps) {
  const { hidden, locale } = useSettings()
  if (loading || value === undefined) return <SkeletonAmount />
  const masked = hidden && !unmasked

  // The symbol is set as part of the figure, so it is split off rather than stripped:
  // "F CFA", "₦" and "€" are not "$", and some locales put the symbol first.
  const money = unit ? undefined : splitMoney(value, { locale, currency, signed })
  const symbol = money?.symbol ?? ''
  const number = unit ? formatNumber(value, { locale, maxFraction: maxFraction ?? 8, signed }) : money!.number

  const hasDelta = delta !== undefined || deltaPct !== undefined
  const deltaTone = (deltaPct ?? delta ?? 0) > 0 ? styles.pos : (deltaPct ?? delta ?? 0) < 0 ? styles.neg : styles.flat

  return (
    <div className={cn(styles.wrap, align === 'center' && styles.center, className)}>
      <div
        className={cn(styles.amount, size === 'h1' && styles.h1, tone && value > 0 && styles.amountPos, tone && value < 0 && styles.amountNeg)}
        aria-label={masked ? 'Montant masqué' : unit ? `${number} ${unit}` : moneyAriaLabel(value, { locale, currency })}
        role="text"
      >
        {money?.prefix && !masked ? <span className={styles.symbolFirst}>{symbol}</span> : null}
        {masked ? (
          <span className={styles.number}>{MASKED}</span>
        ) : (
          <span className={styles.number}>{number}</span>
        )}
        {money && !money.prefix ? <span className={styles.symbol}>{symbol}</span> : null}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      {hasDelta ? (
        <p className={cn(styles.delta, deltaTone)} aria-label={masked ? undefined : `${delta !== undefined ? moneyAriaLabel(delta, { locale, currency }) + ', ' : ''}${deltaPct !== undefined ? percentAriaLabel(deltaPct, { locale }) : ''}${period ? `, ${period}` : ''}`}>
          {masked ? MASKED : [delta !== undefined ? formatMoney(delta, { locale, currency, signed: true }) : null, deltaPct !== undefined ? formatPercent(deltaPct, { locale }) : null, period ?? null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </div>
  )
}
