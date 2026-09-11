/**
 * Inline fiat amount with:
 * - localised formatting (fr-CA / en-CA)
 * - tabular numerals
 * - long-form aria-label for screen readers
 * - privacy masking when balances are hidden
 */
import type { HTMLAttributes } from 'react'
import { formatMoney, maskedMoney, moneyAriaLabel, type MoneyOptions } from '@/lib/format'
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

export function Money({ value, tone = false, unmasked = false, signed, compactCents, maxFraction, currency, className, ...rest }: MoneyProps) {
  const { hidden, locale } = useSettings()
  const masked = hidden && !unmasked
  const text = masked ? maskedMoney({ locale, currency }) : formatMoney(value, { locale, signed, compactCents, maxFraction, currency })
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
  /** 'text' sits inline; 'pill' encloses it in a rounded chip, as on a stat card. */
  variant?: 'text' | 'pill'
  className?: string
}

/**
 * Percentage delta. The sign is always explicit — the palette is monochrome, so direction
 * is never carried by hue.
 */
export function Delta({ value, suffix, variant = 'text', className, ...rest }: DeltaProps) {
  const { locale } = useSettings()
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Math.abs(value))
  const text = `${sign}${abs} %${suffix ? ` · ${suffix}` : ''}`
  const dir = value > 0 ? 'en hausse de' : value < 0 ? 'en baisse de' : 'stable'
  return (
    <span
      className={cn(styles.money, variant === 'pill' && styles.pill, value > 0 && styles.pos, value < 0 && styles.neg, className)}
      aria-label={value === 0 ? 'stable' : `${dir} ${abs} pour cent${suffix ? ` sur ${suffix}` : ''}`}
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
