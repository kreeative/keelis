import { describe, expect, it } from 'vitest'
import { calcDigit, calcExpression, calcFromValue, calcOperator, calcSettle, calcValue, emptyCalc, toKeypadRaw } from './calc'

const XOF = 'XOF' as const
const EUR = 'EUR' as const
const v = (s: Parameters<typeof calcValue>[0]) => calcValue(s, XOF)

describe('calcValue', () => {
  it('is just the operand when nothing is pending', () => {
    expect(v(calcFromValue('1500'))).toBe(1500)
    expect(v(emptyCalc)).toBe(0)
  })

  it('resolves live, so the figure on screen is the figure that gets sent', () => {
    let s = calcFromValue('5000')
    s = calcOperator(s, '×', XOF)
    // Before the second operand arrives, the total is still the left-hand side — not zero.
    expect(v(s)).toBe(5000)
    s = calcDigit(s, '3')
    expect(v(s)).toBe(15000)
  })

  it('does each of the four operations', () => {
    const run = (a: string, op: Parameters<typeof calcOperator>[1], b: string) =>
      v(calcDigit(calcOperator(calcFromValue(a), op, XOF), b))
    expect(run('10000', '+', '2500')).toBe(12500)
    expect(run('10000', '−', '2500')).toBe(7500)
    expect(run('10000', '×', '3')).toBe(30000)
    expect(run('10000', '÷', '4')).toBe(2500)
  })

  it('rounds to the currency, so a third of a sum is still payable', () => {
    // XOF has no centimes: 10 000 / 3 must come out in whole francs.
    const third = calcDigit(calcOperator(calcFromValue('10000'), '÷', XOF), '3')
    expect(Number.isInteger(v(third))).toBe(true)
    expect(v(third)).toBe(3333)
    // The same division in euros keeps its centimes.
    expect(calcValue(third, EUR)).toBeCloseTo(3333.33, 2)
  })

  it('holds the left-hand side rather than blowing up on a divisor of zero', () => {
    let s = calcOperator(calcFromValue('10000'), '÷', XOF)
    s = calcDigit(s, '0')
    expect(Number.isFinite(v(s))).toBe(true)
    expect(v(s)).toBe(10000)
  })
})

describe('a second operator settles the first', () => {
  it('works left to right with no precedence — 100 + 20 × 3 is 360, not 160', () => {
    // Precedence on a two-line display is how calculators trick people. Pressing the
    // second operator settles the first, so what is on screen has already been worked out.
    let s = calcFromValue('100')
    s = calcOperator(s, '+', XOF)
    s = calcDigit(s, '20')
    expect(v(s)).toBe(120)
    s = calcOperator(s, '×', XOF)
    expect(v(s)).toBe(120) // settled before the next operand
    s = calcDigit(s, '3')
    expect(v(s)).toBe(360)
  })

  it('lets an operator be corrected without losing the left-hand side', () => {
    let s = calcOperator(calcFromValue('900'), '+', XOF)
    s = calcOperator(s, '×', XOF) // changed their mind
    expect(s.acc).toBe(900)
    expect(s.op).toBe('×')
    expect(v(calcDigit(s, '2'))).toBe(1800)
  })
})

describe('calcSettle', () => {
  it('folds the pending operation into a plain operand', () => {
    let s = calcDigit(calcOperator(calcFromValue('5000'), '+', XOF), '250')
    s = calcSettle(s, XOF)
    expect(s.acc).toBeNull()
    expect(s.op).toBeNull()
    expect(s.raw).toBe('5250')
    expect(v(s)).toBe(5250)
  })

  it('is a no-op when nothing is pending', () => {
    const s = calcFromValue('42')
    expect(calcSettle(s, XOF)).toBe(s)
  })
})

describe('calcExpression', () => {
  const fmt = (n: number) => String(n)
  it('shows the working while something is pending, and nothing otherwise', () => {
    expect(calcExpression(calcFromValue('500'), fmt)).toBe('')
    const pending = calcOperator(calcFromValue('500'), '×', XOF)
    expect(calcExpression(pending, fmt)).toBe('500 ×')
    expect(calcExpression(calcDigit(pending, '4'), fmt)).toBe('500 × 4')
  })

  it('does not put a currency on a multiplier — francs times francs is nonsense', () => {
    const money = (n: number) => `${n} F CFA`
    const plain = (n: number) => String(n)
    const times = calcDigit(calcOperator(calcFromValue('25000'), '×', XOF), '3')
    expect(calcExpression(times, money, plain)).toBe('25000 F CFA × 3')
    const over = calcDigit(calcOperator(calcFromValue('25000'), '÷', XOF), '4')
    expect(calcExpression(over, money, plain)).toBe('25000 F CFA ÷ 4')
    // Addition really does have money on both sides.
    const plus = calcDigit(calcOperator(calcFromValue('25000'), '+', XOF), '500')
    expect(calcExpression(plus, money, plain)).toBe('25000 F CFA + 500 F CFA')
  })
})

describe('toKeypadRaw', () => {
  it('uses the keypad internal comma and drops a currency-irrelevant fraction', () => {
    expect(toKeypadRaw(3333.333, XOF)).toBe('3333')
    expect(toKeypadRaw(12.5, EUR)).toBe('12,5')
    expect(toKeypadRaw(Number.NaN, XOF)).toBe('')
  })
})
