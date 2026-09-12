/**
 * Big amount + keypad. The hero number is what the user types.
 * Optional fiat ↔ crypto toggle (for trades) and quick-amount chips.
 */
import { useMemo, useRef, useState } from 'react'
import { Button, Icon, Keypad } from '@/components'
import { DEFAULT_CURRENCY, formatAmountInput, formatCrypto, formatMoney, formatNumber, moneyAriaLabel, parseAmountInput, splitMoney } from '@/lib/format'
import { isCurrency } from '@/lib/currency'
import { calcDigit, calcExpression, calcFromValue, calcOperator, calcValue, toKeypadRaw, type CalcState } from '@/lib/calc'
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
  /** Offer the four operations above the keypad. */
  calculator?: boolean
  /** Quick amount chips (fiat only) */
  presets?: number[]
  /** "Max" chip handler */
  onMax?: () => void
  maxDecimals?: number
  disabled?: boolean
  label: string
}

export function AmountEntry({ value, onChange, mode = 'fiat', unit = DEFAULT_CURRENCY, secondary, onToggleMode, error, presets, onMax, maxDecimals, disabled, label, calculator = false }: AmountEntryProps) {
  const { locale } = useSettings()

  /* The running calculation lives here, not in the parent: `value` stays what it always
     was — the resolved amount — so every screen using AmountEntry is untouched. When the
     parent sets it from outside (a preset, Max), the pending operation is dropped, because
     "5 000 ×" followed by someone tapping 50 000 is no longer an expression they meant. */
  const currency = isCurrency(unit) ? unit : DEFAULT_CURRENCY
  const [calc, setCalc] = useState<CalcState>(() => calcFromValue(value))
  /* Resync against what this component last *emitted*, not against its own resolved
     value. Comparing to the resolved value loops forever: an empty field emits '' while
     resolving to '0', the two never agree, and the render-phase setState never settles. */
  const emitted = useRef(value)
  if (calculator && value !== emitted.current) {
    emitted.current = value
    setCalc(calcFromValue(value))
  }

  const pushCalc = (next: CalcState) => {
    const out = toKeypadRaw(calcValue(next, currency), currency)
    emitted.current = out
    setCalc(next)
    onChange(out)
  }

  const numeric = parseAmountInput(value)
  const display = useMemo(() => formatAmountInput(value, locale), [value, locale])
  const empty = value === '' || numeric === 0
  const aria = mode === 'fiat' ? moneyAriaLabel(numeric, { locale, currency: isCurrency(unit) ? unit : undefined }) : `${formatCrypto(numeric, unit, { locale })}`
  /* A currency gets its real symbol at full size — "F CFA", "€", "₦" — because it is part
     of the figure. A crypto ticker stays a word and recedes. The old code compared the
     unit to 'CAD' and assumed "$", which silently printed the bare code for everything
     else the moment the app stopped being Canadian. */
  const money = isCurrency(unit) ? splitMoney(0, { locale, currency: unit }) : undefined
  const symbol = money?.symbol ?? unit
  const symbolFirst = money?.prefix ?? false
  const symbolClass = money ? styles.symbol : styles.unit
  /* While an operation is pending the line under the figure shows the working, so the
     hero can stay the answer. A pending expression that only resolves on submit is a way
     to send an amount nobody read. */
  const working = calculator ? calcExpression(calc, (n) => formatMoney(n, { locale, currency }), (n) => formatNumber(n, { locale, maxFraction: 4 })) || undefined : undefined

  return (
    <div className={styles.wrap}>
      <div className={cn(styles.amount, empty && styles.empty)} role="text" aria-label={`${label} : ${aria}`}>
        {symbolFirst ? <span className={symbolClass}>{symbol}</span> : null}
        <span className={styles.number}>{display}</span>
        {!symbolFirst ? <span className={symbolClass}>{symbol}</span> : null}
        {onToggleMode ? (
          <Button variant="secondary" iconOnly aria-label={mode === 'fiat' ? 'Saisir en crypto' : 'Saisir en dollars'} onClick={onToggleMode} className={styles.swap} disabled={disabled}>
            <Icon name="transfer" size={18} />
          </Button>
        ) : null}
      </div>
      <p className={cn(styles.secondary, error && styles.error)} role={error ? 'alert' : undefined} aria-live="polite">
        {error ? <Icon name="circle-alert" size={16} className={styles.errorIcon} /> : null}
        <span>{error ?? working ?? secondary ?? ' '}</span>
      </p>
      {presets?.length || onMax ? (
        <div className={styles.presets} role="group" aria-label="Montants rapides">
          {presets?.map((p) => (
            <button key={p} type="button" className={styles.chip} onClick={() => onChange(String(p))} disabled={disabled}>
              {formatMoney(p, { locale })}
            </button>
          ))}
          {onMax ? (
            <button type="button" className={styles.chip} onClick={onMax} disabled={disabled}>
              Max
            </button>
          ) : null}
        </div>
      ) : null}
      <Keypad
        /* After an operator the pad starts from empty, so the next digit opens a new
           operand instead of being appended to the left-hand side still on screen. */
        value={calculator ? (calc.fresh ? '' : calc.raw) : value}
        onChange={(next) => (calculator ? pushCalc(calcDigit(calc, next)) : onChange(next))}
        maxDecimals={maxDecimals ?? (mode === 'fiat' ? 2 : 8)}
        disabled={disabled}
        operators={calculator}
        activeOperator={calculator ? calc.op : null}
        onOperator={calculator ? (op) => pushCalc(calcOperator(calc, op, currency)) : undefined}
      />
    </div>
  )
}
