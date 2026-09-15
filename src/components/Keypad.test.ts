import { describe, expect, it } from 'vitest'
import { keyFromEvent, keypadReduce } from './Keypad'

describe('keypadReduce', () => {
  it('appends digits and replaces a lone zero', () => {
    expect(keypadReduce('', '5')).toBe('5')
    expect(keypadReduce('0', '5')).toBe('5')
    expect(keypadReduce('12', '3')).toBe('123')
  })
  it('handles the decimal comma once', () => {
    expect(keypadReduce('', ',')).toBe('0,')
    expect(keypadReduce('12', ',')).toBe('12,')
    expect(keypadReduce('12,', ',')).toBe('12,')
  })
  it('limits decimals', () => {
    expect(keypadReduce('12,34', '5', { maxDecimals: 2 })).toBe('12,34')
    expect(keypadReduce('0,1234567', '8', { maxDecimals: 8 })).toBe('0,12345678')
  })
  it('backspaces', () => {
    expect(keypadReduce('12,3', 'back')).toBe('12,')
    expect(keypadReduce('', 'back')).toBe('')
  })
  it('respects integerOnly', () => {
    expect(keypadReduce('12', ',', { integerOnly: true })).toBe('12')
  })
})

describe('keypadReduce — values seeded from outside', () => {
  it('normalises a dot decimal so the cap still applies', () => {
    // A "Max" button or a deep link may hand over "4218.37".
    expect(keypadReduce('4218.37', '9', { maxDecimals: 2 })).toBe('4218,37')
    expect(keypadReduce('4218.37', ',', { maxDecimals: 2 })).toBe('4218,37')
    expect(keypadReduce('4218.3', '7', { maxDecimals: 2 })).toBe('4218,37')
  })
})

describe('keyFromEvent', () => {
  it('maps the number row and the decimal marks', () => {
    expect(keyFromEvent({ key: '7' })).toBe('7')
    // Both marks reach the same key: the pad's face shows a point, its string carries a comma.
    expect(keyFromEvent({ key: '.' })).toBe(',')
    expect(keyFromEvent({ key: ',' })).toBe(',')
    expect(keyFromEvent({ key: 'Backspace' })).toBe('back')
    expect(keyFromEvent({ key: 'Delete' })).toBe('back')
  })

  it('gives a shortcut back to the browser', () => {
    // ⌘R is a reload and ⌃C is a copy. Swallowing either would be worse than ignoring
    // the keyboard altogether.
    expect(keyFromEvent({ key: 'r', metaKey: true })).toBeNull()
    expect(keyFromEvent({ key: '5', metaKey: true })).toBeNull()
    expect(keyFromEvent({ key: '5', ctrlKey: true })).toBeNull()
  })

  it('ignores everything that is not a key on the pad', () => {
    expect(keyFromEvent({ key: 'Enter' })).toBeNull()
    expect(keyFromEvent({ key: 'Tab' })).toBeNull()
    expect(keyFromEvent({ key: 'a' })).toBeNull()
    expect(keyFromEvent({ key: 'ArrowLeft' })).toBeNull()
  })

  it('takes the operators only where the pad offers them', () => {
    expect(keyFromEvent({ key: '+' })).toBeNull()
    expect(keyFromEvent({ key: '+' }, { operators: true })).toBe('+')
    // A typed hyphen is the minus sign the pad draws, and `x` is what people type for ×.
    expect(keyFromEvent({ key: '-' }, { operators: true })).toBe('−')
    expect(keyFromEvent({ key: 'x' }, { operators: true })).toBe('×')
    expect(keyFromEvent({ key: '*' }, { operators: true })).toBe('×')
    expect(keyFromEvent({ key: '/' }, { operators: true })).toBe('÷')
  })

  it('refuses a decimal on a pad that has no decimal key', () => {
    // The PIN pad. Its own reducer would drop the comma anyway, but the keystroke should
    // not be swallowed from the page either.
    expect(keyFromEvent({ key: '.' }, { integerOnly: true })).toBeNull()
    expect(keyFromEvent({ key: '4' }, { integerOnly: true })).toBe('4')
  })
})
