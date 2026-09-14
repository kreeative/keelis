/**
 * Inline fiat amount with:
 * - localised formatting (fr-SN / en-NG)
 * - tabular numerals
 * - long-form aria-label for screen readers
 * - privacy masking when balances are hidden
 */
import type { HTMLAttributes } from 'react'
import { formatMoney, formatNumber, maskedMoney, moneyAriaLabel, type MoneyOptions } from '@/lib/format'
import { useSettings } from '@/store/settings'
import { cn } from '@/lib/cn'
import styles from './Money.module.css'

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement>, MoneyOptions {
  value: number
  /** Colour by sign (pos/neg). Default false. */
  tone?: boolean
  /** Ignore the privacy mask (e.g. amounts the user is typing) */
  unmasked?: boolean
}

export function Money({ value, tone = false, unmasked = false, signed, alwaysCents, maxFraction, currency, className, ...rest }: MoneyProps) {
  const { hidden, locale } = useSettings()
  const masked = hidden && !unmasked
  const text = masked ? maskedMoney({ locale, currency }) : formatMoney(value, { locale, signed, alwaysCents, maxFraction, currency })
  const label = masked ? 'Montant masqué' : moneyAriaLabel(value, { locale, currency })
  return (
    <span className={cn(styles.money, tone && value > 0 && styles.pos, tone && value < 0 && styles.neg, className)} aria-label={label} {...rest}>
      {text}
    </span>
  )
}

export interface DeltaProps extends HTMLAttributes<HTMLSpanElement> {
  value: number
  /** Trailing context, e.g. « 24 h », « ce mois-ci » */
  suffix?: string
  /** The same move in dollars. Shown before the percentage, which goes in brackets —
      a percentage alone does not say whether it was worth 4 $ or 400 $. */
  amount?: number
  /** 'text' sits inline; 'pill' encloses it in a rounded chip, as on a stat card. */
  variant?: 'text' | 'pill'
  className?: string
}

/**
 * Percentage delta. The sign is always explicit — the palette is monochrome, so direction
 * is never carried by hue.
 */
export function Delta({ value, suffix, amount, variant = 'text', className, ...rest }: DeltaProps) {
  const { locale, hidden } = useSettings()
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  /* Through `formatNumber`, never a bare `Intl.NumberFormat`. The app carries one number
     punctuation — comma groups, point decimal — and it lives in `joinParts`, which a raw
     formatter skips: this line printed « +8,01 % » beside « +346,345 F CFA », comma
     decimal against comma thousands, in the same sentence. Every percentage in the app
     goes through a Delta, so every one of them was wrong. */
  const abs = formatNumber(Math.abs(value), { locale, minFraction: 1, maxFraction: 2 })
  const pct = `${sign}${abs} %`
  const money = amount === undefined ? null : hidden ? maskedMoney({ locale }) : formatMoney(amount, { locale, signed: true })
  const text = `${money ? `${money} (${pct})` : pct}${suffix ? ` · ${suffix}` : ''}`
  const dir = value > 0 ? 'en hausse de' : value < 0 ? 'en baisse de' : 'stable'
  return (
    <span
      className={cn(styles.money, variant === 'pill' && styles.pill, value > 0 && styles.pos, value < 0 && styles.neg, className)}
      aria-label={value === 0 ? 'stable' : `${dir} ${abs} pour cent${money ? `, soit ${money}` : ''}${suffix ? ` sur ${suffix}` : ''}`}
      {...rest}
    >
      {text}
    </span>
  )
}

export interface MoneyDeltaProps extends HTMLAttributes<HTMLSpanElement> {
  /** Signed fiat change */
  value: number
  suffix?: string
  variant?: 'text' | 'pill'
  className?: string
}

/** Same chip, carrying a money amount instead of a percentage (« +100,00 $ ce mois-ci »). */
export function MoneyDelta({ value, suffix, variant = 'pill', className, ...rest }: MoneyDeltaProps) {
  const { hidden, locale } = useSettings()
  const text = hidden ? maskedMoney({ locale }) : `${formatMoney(value, { locale, signed: true })}${suffix ? ` ${suffix}` : ''}`
  return (
    <span
      className={cn(styles.money, variant === 'pill' && styles.pill, className)}
      aria-label={hidden ? 'Montant masqué' : `${moneyAriaLabel(value, { locale })}${suffix ? `, ${suffix}` : ''}`}
      {...rest}
    >
      {text}
    </span>
  )
}
