/**
 * The send form asked for « Courriel » on every rail, with an email keyboard and an email
 * validator, while its label changed to say « Numéro de téléphone ». A Wave transfer — the
 * commonest way money moves in this zone — could therefore not be completed at all. These
 * tests pin the pairing that fixes it.
 */
import { describe, expect, it } from 'vitest'
import { handleField, HANDLE_FIELD } from './handle'

describe('the recipient field follows the rail', () => {
  it('asks for a phone number before any operator is chosen', () => {
    // Not an email: in this market the phone number is the account.
    expect(handleField(undefined).inputMode).toBe('tel')
  })

  it('opens the right keyboard for each handle', () => {
    expect(HANDLE_FIELD.phone.inputMode).toBe('tel')
    expect(HANDLE_FIELD.email.inputMode).toBe('email')
    expect(HANDLE_FIELD.tag.inputMode).toBe('text')
    expect(HANDLE_FIELD.account.inputMode).toBe('text')
  })

  it('accepts a Senegalese number, spaces and indicatif included', () => {
    expect(HANDLE_FIELD.phone.test('+221 77 555 01 48')).toBe(true)
    expect(HANDLE_FIELD.phone.test('771234567')).toBe(true)
  })

  it('rejects an email in the phone field, which is exactly what used to pass', () => {
    expect(HANDLE_FIELD.phone.test('nom@exemple.sn')).toBe(false)
    expect(HANDLE_FIELD.phone.test('77 55')).toBe(false)
  })

  it('accepts a tag with or without the @', () => {
    expect(HANDLE_FIELD.tag.test('@aissatou')).toBe(true)
    expect(HANDLE_FIELD.tag.test('aissatou')).toBe(true)
    expect(HANDLE_FIELD.tag.test('ai')).toBe(false)
  })

  it('gives every handle its own sentence', () => {
    const errors = Object.values(HANDLE_FIELD).map((f) => f.error)
    // « Invalide » on a field like this says nothing about where to look.
    expect(new Set(errors).size).toBe(errors.length)
  })
})
