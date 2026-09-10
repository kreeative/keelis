import { describe, expect, it } from 'vitest'
import { keypadReduce } from './Keypad'

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
