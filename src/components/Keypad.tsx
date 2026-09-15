/**
 * 3×4 numeric keypad for amounts: digits, decimal comma, backspace.
 * Controlled: value is a raw string like "1234,5" (locale-agnostic internally).
 *
 * **It listens to the real keyboard too, and that is not a nicety.** This pad is the only
 * way to enter an amount anywhere in the app — every money flow, and the PIN — and on a
 * computer the number row did nothing at all: sending 250,000 F CFA meant clicking six
 * lozenges one at a time while a keyboard sat under the person's hands. The keyboard walk
 * could not see it, because the keys are buttons and Tab-then-Enter works perfectly; what
 * did not work was typing. Digits, `.` and `,`, Backspace and the four operators all go
 * through the same reducer the taps do.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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

/** How long a key stays lit after a physical keystroke — long enough to see, short
    enough not to lag someone typing a six-figure amount. */
const FLASH_MS = 140

/** Physical-keyboard equivalents of the four operator keys. `x` because people type it. */
const KEY_TO_OP: Record<string, CalcOp> = { '+': '+', '-': '−', '−': '−', '*': '×', x: '×', X: '×', '×': '×', '/': '÷', '÷': '÷' }

/**
 * The pad key a physical keystroke means, or null for a keystroke that is not ours.
 *
 * Pure, so it can be tested without a DOM. A modifier always means null — ⌘R is a reload
 * and ⌃C is a copy, and a keypad that swallowed either would be worse than one that
 * ignored the keyboard entirely.
 */
export function keyFromEvent(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  opts: { operators?: boolean; integerOnly?: boolean } = {},
): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (/^\d$/.test(e.key)) return e.key
  if (e.key === '.' || e.key === ',') return opts.integerOnly ? null : ','
  if (e.key === 'Backspace' || e.key === 'Delete') return 'back'
  const op = opts.operators ? KEY_TO_OP[e.key] : undefined
  return op ?? null
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
  /* The listener is bound once; `press` closes over `value`, which changes on every
     keystroke. Through a ref it always calls the current one without tearing the listener
     down and rebuilding it twelve times while somebody types an amount. */
  const pressRef = useRef(press)
  pressRef.current = press

  /* The key a physical keystroke just drove, so it lights up like a tap. Without it a
     keyboard entry is a number appearing with nothing to say where it came from. */
  const [struck, setStruck] = useState<string | null>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const flashTimer = useRef(0)
  const flash = (k: string) => {
    setStruck(k)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setStruck(null), FLASH_MS)
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      const el = padRef.current
      if (!el) return
      /* Never take a keystroke away from something being typed into: the grouped desktop
         form puts a recipient's name, a phone number and a message on the same page as
         this pad, and a « 7 » typed into the message belongs to the message. */
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      /* Nor from anything that has already claimed it. A screen with its own handler wins,
         and the event says so — which is what keeps this from doubling a keystroke rather
         than a rule about who was written first. */
      if (e.defaultPrevented) return
      /* Nor from a sheet sitting over the page. A confirmation opens on top of the very
         amount it is confirming, and typing behind it would change the figure being agreed
         to. The *topmost* dialog is the last one in the document that is not inert: the lock
         screen is a portal appended to the body, so it comes after any sheet already open,
         and `Sheet` keeps a closing one mounted for the length of its exit. */
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter((d) => !d.hasAttribute('inert'))
      const top = dialogs[dialogs.length - 1]
      if (top && !top.contains(el)) return
      /* And never when two pads are on screen at once: there is no way to know which one a
         keystroke meant, and guessing is worse than declining. No screen does this today —
         the components gallery comes closest and keeps its second pad inside a sheet, which
         the rule above already resolves — so this is a guard rather than a fix, put here
         because the alternative is a keystroke silently landing in the wrong figure. Taps
         stay unambiguous and go on working on both. */
      const pads = Array.from((top ?? document).querySelectorAll('[data-keypad]')).filter((n) => !n.closest('[inert]'))
      if (pads.length !== 1) return
      const key = keyFromEvent(e, { operators, integerOnly })
      if (!key) return
      /* Asked against the operator list itself, not against the key map: the map holds
         aliases (`x`, `*`, `-`) whose *values* happen to be operators too, so testing
         membership there works only by accident and would stop the day an alias went. */
      const isOp = (CALC_OPS as readonly string[]).includes(key)
      if (isOp && !onOperator) return
      e.preventDefault()
      if (isOp) {
        tick()
        onOperator?.(key as CalcOp)
      } else {
        pressRef.current(key)
      }
      flash(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, operators, integerOnly, onOperator])

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
              className={cn(styles.op, activeOperator === op && styles.opActive, struck === op && styles.opStruck)}
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
    <div className={styles.pad} role="group" aria-label="Pavé numérique" ref={padRef} data-keypad="">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={`gap-${i}`} aria-hidden="true" />
        ) : (
          <button
            key={k}
            type="button"
            className={cn(styles.key, struck === k && styles.struck)}
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
