/**
 * The hero number. Amount in `display`, currency in `h2` on the same baseline,
 * optional delta line below ("+12,40 $ · +1,4 % · 24 h").
 */
import type { CSSProperties } from 'react'
import { DEFAULT_CURRENCY, MASKED, formatMoney, formatNumber, formatPercent, moneyAriaLabel, percentAriaLabel, splitMoney } from '@/lib/format'
import { useCountUp } from '@/lib/useCountUp'
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
  /**
   * Let the figure count into place when it lands. Off by default, and it must stay off
   * wherever the value changes continuously — scrubbing a chart, above all: animating
   * between scrubbed values would lag the finger and make the number unreadable.
   */
  animate?: boolean
}

export function AmountDisplay({ value, currency = DEFAULT_CURRENCY, delta, deltaPct, period, caption, unit, maxFraction, signed = false, tone = false, size = 'display', loading, align = 'start', className, unmasked, animate = false }: AmountDisplayProps) {
  const { hidden, locale } = useSettings()
  /* Hooks run before the early return: a masked balance still has a value underneath, and
     unmasking it should not restart the animation from nothing. */
  const shown = useCountUp(value, animate && !hidden)
  if (loading || value === undefined || shown === undefined) return <SkeletonAmount />
  const masked = hidden && !unmasked

  // The symbol is set as part of the figure, so it is split off rather than stripped:
  // "F CFA", "₦" and "€" are not "$", and some locales put the symbol first.
  const money = unit ? undefined : splitMoney(shown, { locale, currency, signed })
  const symbol = money?.symbol ?? ''
  const number = unit ? formatNumber(shown, { locale, maxFraction: maxFraction ?? 8, signed }) : money!.number

  const hasDelta = delta !== undefined || deltaPct !== undefined
  const deltaTone = (deltaPct ?? delta ?? 0) > 0 ? styles.pos : (deltaPct ?? delta ?? 0) < 0 ? styles.neg : styles.flat

  /* A figure must never wrap. "10,792,539 XOF" broke across two lines mid-number and
     mid-symbol, which is the one thing a hero amount cannot do.
     Rather than measure and re-measure in JS, the character count picks a ceiling in
     container-relative units: a tabular digit in Poppins is about 0.55em wide, so N
     characters fit when the size is at most (100 / (N × 0.55)) cqi. The CSS takes the
     smaller of that and the display size, so short amounts are unaffected and long ones
     step down exactly as far as they need to. */
  const chars = (masked ? MASKED : number).length + (symbol ? symbol.length + 1 : 0) + (unit ? unit.length + 1 : 0)
  const fit = 100 / (chars * 0.55)

  return (
    <div className={cn(styles.wrap, align === 'center' && styles.center, className)}>
      <div
        style={{ '--amount-fit': fit } as CSSProperties}
        className={cn(styles.amount, size === 'h1' && styles.h1, tone && value > 0 && styles.amountPos, tone && value < 0 && styles.amountNeg)}
        /* The label reads the real value, never the animated one: a screen reader should
           hear the balance, not a frame of it on its way there. */
        aria-label={masked ? 'Montant masqué' : unit ? `${formatNumber(value, { locale, maxFraction: maxFraction ?? 8, signed })} ${unit}` : moneyAriaLabel(value, { locale, currency })}
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
