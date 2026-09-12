/**
 * 3×4 numeric keypad for amounts: digits, decimal comma, backspace.
 * Controlled: value is a raw string like "1234,5" (locale-agnostic internally).
 */
import { useCallback } from 'react'
import { cn } from '@/lib/cn'
import { tick } from '@/lib/haptics'
import { CALC_OPS, type CalcOp } from '@/lib/calc'
import { Icon } from './Icon'
import styles from './Keypad.module.css'

export interface KeypadProps {
  /** Show the four operations above the digits. */
  operators?: boolean
  /** Called when one is pressed; the caller owns the running calculation. */
  onOperator?: (op: CalcOp) => void
  /** The operator currently pending, so its key can show as held. */
  activeOperator?: CalcOp | null
  value: string
  onChange: (next: string) => void
  /** Max decimals allowed (2 for fiat, 8 for crypto) */
  maxDecimals?: number
  maxLength?: number
  /** Hide the decimal key (PIN entry) */
  integerOnly?: boolean
  disabled?: boolean
}

export function keypadReduce(rawValue: string, key: string, opts: { maxDecimals?: number; maxLength?: number; integerOnly?: boolean } = {}): string {
  const maxDecimals = opts.maxDecimals ?? 2
  const maxLength = opts.maxLength ?? 12
  // A value seeded from outside (a Max button, a deep link) may carry a '.' decimal.
  // Normalise first, or the decimal cap below would not see it.
  const value = rawValue.replace('.', ',')
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

export function Keypad({ value, onChange, maxDecimals = 2, maxLength = 12, integerOnly = false, disabled = false, operators = false, onOperator, activeOperator = null }: KeypadProps) {
  const press = useCallback(
    (key: string) => {
      if (disabled) return
      tick()
      onChange(keypadReduce(value, key, { maxDecimals, maxLength, integerOnly }))
    },
    [value, onChange, maxDecimals, maxLength, integerOnly, disabled],
  )
  /* One decimal mark app-wide — a point, matching how every figure is punctuated. The
     value is still carried internally with a comma, so the reducer and its tests are
     untouched; only the key's face and its label change. */
  const decimal = '.'
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', integerOnly ? '' : ',', '0', 'back']

  const OP_LABEL: Record<CalcOp, string> = { '+': 'Plus', '−': 'Moins', '×': 'Multiplié par', '÷': 'Divisé par' }

  return (
    <div className={styles.wrap}>
      {/* The four operations sit above the digits, as a row of their own: someone splitting
          a bill or sending three months of rent should not have to leave for the phone's
          calculator and come back with a number they then retype. */}
      {operators ? (
        <div className={styles.ops} role="group" aria-label="Opérations">
          {CALC_OPS.map((op) => (
            <button
              key={op}
              type="button"
              className={cn(styles.op, activeOperator === op && styles.opActive)}
              onClick={() => {
                if (disabled) return
                tick()
                onOperator?.(op)
              }}
              disabled={disabled || !onOperator}
              aria-label={OP_LABEL[op]}
              aria-pressed={activeOperator === op}
            >
              {op}
            </button>
          ))}
        </div>
      ) : null}
    <div className={styles.pad} role="group" aria-label="Pavé numérique">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={`gap-${i}`} aria-hidden="true" />
        ) : (
          <button
            key={k}
            type="button"
            className={styles.key}
            onClick={() => press(k)}
            disabled={disabled}
            aria-label={k === 'back' ? 'Effacer' : k === ',' ? 'Point décimal' : k}
          >
            {k === 'back' ? <Icon name="delete" /> : k === ',' ? decimal : k}
          </button>
        ),
      )}
    </div>
    </div>
  )
}
