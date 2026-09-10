/**
 * The hero number. Amount in `display`, currency in `h2` on the same baseline,
 * optional delta line below ("+12,40 $ · +1,4 % · 24 h").
 */
import { MASKED, formatMoney, formatPercent, moneyAriaLabel, percentAriaLabel } from '@/lib/format'
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
  /** Show crypto quantity instead of currency symbol layout, e.g. "0,0428 BTC" */
  unit?: string
  size?: 'display' | 'h1'
  loading?: boolean
  align?: 'start' | 'center'
  className?: string
  /** Ignore privacy mask */
  unmasked?: boolean
}

export function AmountDisplay({ value, currency = 'CAD', delta, deltaPct, period, caption, unit, size = 'display', loading, align = 'start', className, unmasked }: AmountDisplayProps) {
  const { hidden, locale } = useSettings()
  if (loading || value === undefined) return <SkeletonAmount />
  const masked = hidden && !unmasked

  // Split "1 234,56 $" into number + symbol so the symbol can sit in h2.
  const full = formatMoney(value, { locale, currency })
  const symbol = currency === 'CAD' ? '$' : currency
  const number = unit ? full : full.replace(symbol, '').trim()

  const hasDelta = delta !== undefined || deltaPct !== undefined
  const tone = (deltaPct ?? delta ?? 0) > 0 ? styles.pos : (deltaPct ?? delta ?? 0) < 0 ? styles.neg : styles.flat

  return (
    <div className={cn(styles.wrap, align === 'center' && styles.center, className)}>
      <div className={cn(styles.amount, size === 'h1' && styles.h1)} aria-label={masked ? 'Montant masqué' : moneyAriaLabel(value, { locale, currency })} role="text">
        <span className={styles.number}>{masked ? MASKED : number}</span>
        {!masked && !unit && (locale === 'fr-CA' ? <span className={styles.currency}>{symbol}</span> : null)}
        {unit ? <span className={styles.currency}>{unit}</span> : null}
      </div>
      {hasDelta ? (
        <p className={cn(styles.delta, tone)} aria-label={masked ? undefined : `${delta !== undefined ? moneyAriaLabel(delta, { locale, currency }) + ', ' : ''}${deltaPct !== undefined ? percentAriaLabel(deltaPct, { locale }) : ''}${period ? `, ${period}` : ''}`}>
          {masked ? MASKED : [delta !== undefined ? formatMoney(delta, { locale, currency, signed: true }) : null, deltaPct !== undefined ? formatPercent(deltaPct, { locale }) : null, period ?? null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </div>
  )
}
