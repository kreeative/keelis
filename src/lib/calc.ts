/**
 * The four operations on an amount keypad.
 *
 * Someone splitting a bill four ways, or sending three months of rent, should not have to
 * leave for the phone's calculator and come back. The model is deliberately the simplest
 * one that is never surprising: **one pending operation at a time, resolved live**.
 *
 * There is no `=` key and no operator precedence. Precedence on a two-line display is how
 * calculators trick people — `100 + 20 × 3` is 160 to a mathematician and 360 to everyone
 * typing it into a till. Keewal Meere does neither: pressing a second operator settles the first
 * one immediately, so what you see is always what has already been worked out.
 *
 * The value is resolved on every keystroke rather than when a key says so, so the figure
 * on screen is the figure that will be sent. A pending expression that only resolves at
 * submit is a way to send an amount nobody read.
 */
import { roundTo, type Currency } from './currency'

export type CalcOp = '+' | '−' | '×' | '÷'

export const CALC_OPS: readonly CalcOp[] = ['+', '−', '×', '÷']

export interface CalcState {
  /** The settled left-hand side, or null when nothing is pending. */
  acc: number | null
  op: CalcOp | null
  /** The operand being typed, as a keypad string (internal decimal is a comma). */
  raw: string
  /** True right after an operator: the next digit starts a fresh operand. */
  fresh: boolean
}

export const emptyCalc: CalcState = { acc: null, op: null, raw: '', fresh: false }

export function calcFromValue(raw: string): CalcState {
  return { acc: null, op: null, raw, fresh: false }
}

function toNumber(raw: string): number {
  if (!raw) return 0
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function apply(a: number, op: CalcOp, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    case '÷':
      // Dividing by nothing yet typed is the normal state mid-entry, not an error to
      // surface: hold the left-hand side until a divisor arrives.
      return b === 0 ? a : a / b
  }
}

/**
 * The amount this state currently represents — what the hero shows and what gets sent.
 * Rounded to the currency's own minor unit, because a third of 10 000 F CFA has to be
 * payable in francs.
 */
export function calcValue(state: CalcState, currency: Currency): number {
  const current = toNumber(state.raw)
  if (state.acc === null || state.op === null) return roundTo(current, currency)
  // Before the second operand is typed, the running total is still the left-hand side.
  if (state.fresh) return roundTo(state.acc, currency)
  return roundTo(apply(state.acc, state.op, current), currency)
}

/** Press an operator. Settles whatever was pending first, so nothing stacks up. */
export function calcOperator(state: CalcState, op: CalcOp, currency: Currency): CalcState {
  const settled = calcValue(state, currency)
  return { acc: settled, op, raw: state.raw, fresh: true }
}

/** Feed a digit / decimal / backspace through, using the keypad's own reducer for the operand. */
export function calcDigit(state: CalcState, next: string): CalcState {
  // The first digit after an operator replaces the operand rather than appending to the
  // left-hand side still on screen.
  return { ...state, raw: next, fresh: false }
}

/** Clear the pending operation, keeping the figure already worked out. */
export function calcSettle(state: CalcState, currency: Currency): CalcState {
  if (state.acc === null || state.op === null) return state
  const total = calcValue(state, currency)
  return { acc: null, op: null, raw: toKeypadRaw(total, currency), fresh: false }
}

/** A number back into the keypad's internal string form (comma decimal, no grouping). */
export function toKeypadRaw(value: number, currency: Currency): string {
  const rounded = roundTo(value, currency)
  if (!Number.isFinite(rounded)) return ''
  return String(rounded).replace('.', ',')
}

/**
 * The expression to show under the figure while something is pending — "5 000 ×".
 * Returns an empty string when there is nothing pending, so the line stays quiet.
 */
export function calcExpression(state: CalcState, format: (n: number) => string, plain: (n: number) => string = format): string {
  if (state.acc === null || state.op === null) return ''
  if (state.fresh) return `${format(state.acc)} ${state.op}`
  /* A multiplier is a count, not a sum: "25 000 F CFA × 3" is right and "× 3 F CFA" is
     nonsense — you do not multiply francs by francs. Addition and subtraction keep money
     on both sides, because there both operands really are amounts. */
  const right = state.op === '×' || state.op === '÷' ? plain : format
  return `${format(state.acc)} ${state.op} ${right(toNumber(state.raw))}`
}
