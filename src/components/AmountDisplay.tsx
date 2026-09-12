/**
 * The hero number. Amount in `display`, currency in `h2` on the same baseline,
 * optional delta line below ("+12,40 $ · +1,4 % · 24 h").
 */
import { MASKED, formatMoney, formatNumber, formatPercent, moneyAriaLabel, percentAriaLabel } from '@/lib/format'
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

export function AmountDisplay({ value, currency = 'CAD', delta, deltaPct, period, caption, unit, maxFraction, signed = false, tone = false, size = 'display', loading, align = 'start', className, unmasked }: AmountDisplayProps) {
  const { hidden, locale } = useSettings()
  if (loading || value === undefined) return <SkeletonAmount />
  const masked = hidden && !unmasked

  // Split "1 234,56 $" into number + symbol so the symbol can sit in h2.
  // With `unit` the value is a quantity, not money: format it as a plain number.
  const symbol = currency === 'CAD' ? '$' : currency
  const number = unit
    ? formatNumber(value, { locale, maxFraction: maxFraction ?? 8, signed })
    : formatMoney(value, { locale, currency, signed }).replace(symbol, '').trim()

  /* The cents are set smaller and quieter than the dollars. In a balance the dollars are
     the figure; the cents are precision, and giving them equal weight makes the number
     harder to read at a glance, not more exact. The split is on the locale's own decimal
     separator, so it holds in fr-CA (comma) and en-CA (point) alike. */
  const sep = unit ? '' : locale === 'fr-CA' ? ',' : '.'
  const cut = sep ? number.lastIndexOf(sep) : -1
  const whole = cut > 0 ? number.slice(0, cut) : number
  const cents = cut > 0 ? number.slice(cut) : ''

  const hasDelta = delta !== undefined || deltaPct !== undefined
  const deltaTone = (deltaPct ?? delta ?? 0) > 0 ? styles.pos : (deltaPct ?? delta ?? 0) < 0 ? styles.neg : styles.flat

  return (
    <div className={cn(styles.wrap, align === 'center' && styles.center, className)}>
      <div
        className={cn(styles.amount, size === 'h1' && styles.h1, tone && value > 0 && styles.amountPos, tone && value < 0 && styles.amountNeg)}
        aria-label={masked ? 'Montant masqué' : unit ? `${number} ${unit}` : moneyAriaLabel(value, { locale, currency })}
        role="text"
      >
        {masked ? (
          <span className={styles.number}>{MASKED}</span>
        ) : (
          <span className={styles.number}>
            {whole}
            {cents ? <span className={styles.cents}>{cents}</span> : null}
          </span>
        )}
        {!unit && locale === 'fr-CA' ? <span className={styles.symbol}>{symbol}</span> : null}
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
