/**
 * 3×4 numeric keypad for amounts: digits, decimal comma, backspace.
 * Controlled: value is a raw string like "1234,5" (locale-agnostic internally).
 */
import { useCallback } from 'react'
import { tick } from '@/lib/haptics'
import { useSettings } from '@/store/settings'
import { Icon } from './Icon'
import styles from './Keypad.module.css'

export interface KeypadProps {
  value: string
  onChange: (next: string) => void
  /** Max decimals allowed (2 for fiat, 8 for crypto) */
  maxDecimals?: number
  maxLength?: number
  /** Hide the decimal key (PIN entry) */
  integerOnly?: boolean
  disabled?: boolean
}

export function keypadReduce(value: string, key: string, opts: { maxDecimals?: number; maxLength?: number; integerOnly?: boolean } = {}): string {
  const maxDecimals = opts.maxDecimals ?? 2
  const maxLength = opts.maxLength ?? 12
  if (key === 'back') return value.slice(0, -1)
  if (key === ',') {
    if (opts.integerOnly || value.includes(',')) return value
    return value === '' ? '0,' : value + ','
  }
  if (!/^\d$/.test(key)) return value
  if (value === '0') return key
  const [, frac] = value.split(',')
  if (frac !== undefined && frac.length >= maxDecimals) return value
  if (value.replace(',', '').length >= maxLength) return value
  return value + key
}

export function Keypad({ value, onChange, maxDecimals = 2, maxLength = 12, integerOnly = false, disabled = false }: KeypadProps) {
  const { locale } = useSettings()
  const press = useCallback(
    (key: string) => {
      if (disabled) return
      tick()
      onChange(keypadReduce(value, key, { maxDecimals, maxLength, integerOnly }))
    },
    [value, onChange, maxDecimals, maxLength, integerOnly, disabled],
  )
  const decimal = locale === 'fr-CA' ? ',' : '.'
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', integerOnly ? '' : ',', '0', 'back']

  return (
    <div className={styles.pad} role="group" aria-label="Pavé numérique">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} aria-hidden="true" />
        ) : (
          <button
            key={k}
            type="button"
            className={styles.key}
            onClick={() => press(k)}
            disabled={disabled}
            aria-label={k === 'back' ? 'Effacer' : k === ',' ? 'Virgule décimale' : k}
          >
            {k === 'back' ? <Icon name="delete" /> : k === ',' ? decimal : k}
          </button>
        ),
      )}
    </div>
  )
}
