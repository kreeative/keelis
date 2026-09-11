/**
 * Big amount + keypad. The hero number is what the user types.
 * Optional fiat ↔ crypto toggle (for trades) and quick-amount chips.
 */
import { useMemo } from 'react'
import { Button, Icon, Keypad } from '@/components'
import { formatAmountInput, formatCrypto, formatMoney, moneyAriaLabel, parseAmountInput } from '@/lib/format'
import { useSettings } from '@/store'
import { cn } from '@/lib/cn'
import styles from './AmountEntry.module.css'

export interface AmountEntryProps {
  /** Raw keypad string, e.g. "125,5" */
  value: string
  onChange: (v: string) => void
  /** 'fiat' shows "$" layout; 'crypto' shows the unit symbol */
  mode?: 'fiat' | 'crypto'
  unit?: string
  /** Secondary line under the amount (e.g. converted value, available balance) */
  secondary?: string
  /** Toggle handler: shows the swap button when provided */
  onToggleMode?: () => void
  /** Validation error shown under the amount */
  error?: string | null
  /** Quick amount chips (fiat only) */
  presets?: number[]
  /** "Max" chip handler */
  onMax?: () => void
  maxDecimals?: number
  disabled?: boolean
  label: string
}

export function AmountEntry({ value, onChange, mode = 'fiat', unit = 'CAD', secondary, onToggleMode, error, presets, onMax, maxDecimals, disabled, label }: AmountEntryProps) {
  const { locale } = useSettings()
  const numeric = parseAmountInput(value)
  const display = useMemo(() => formatAmountInput(value, locale), [value, locale])
  const empty = value === '' || numeric === 0
  const aria = mode === 'fiat' ? moneyAriaLabel(numeric, { locale }) : `${formatCrypto(numeric, unit, { locale })}`
  const symbol = unit === 'CAD' ? '$' : unit
  const symbolFirst = mode === 'fiat' && locale === 'en-CA'

  return (
    <div className={styles.wrap}>
      <div className={cn(styles.amount, empty && styles.empty)} role="text" aria-label={`${label} : ${aria}`}>
        {symbolFirst ? <span className={styles.unit}>{symbol}</span> : null}
        <span className={styles.number}>{display}</span>
        {!symbolFirst ? <span className={styles.unit}>{symbol}</span> : null}
        {onToggleMode ? (
          <Button variant="secondary" iconOnly aria-label={mode === 'fiat' ? 'Saisir en crypto' : 'Saisir en dollars'} onClick={onToggleMode} className={styles.swap} disabled={disabled}>
            <Icon name="transfer" size={18} />
          </Button>
        ) : null}
      </div>
      <p className={cn(styles.secondary, error && styles.error)} role={error ? 'alert' : undefined} aria-live="polite">
        {error ?? secondary ?? ' '}
      </p>
      {presets?.length || onMax ? (
        <div className={styles.presets} role="group" aria-label="Montants rapides">
          {presets?.map((p) => (
            <button key={p} type="button" className={styles.chip} onClick={() => onChange(String(p))} disabled={disabled}>
              {formatMoney(p, { locale, compactCents: true })}
            </button>
          ))}
          {onMax ? (
            <button type="button" className={styles.chip} onClick={onMax} disabled={disabled}>
              Max
            </button>
          ) : null}
        </div>
      ) : null}
      <Keypad value={value} onChange={onChange} maxDecimals={maxDecimals ?? (mode === 'fiat' ? 2 : 8)} disabled={disabled} />
    </div>
  )
}
