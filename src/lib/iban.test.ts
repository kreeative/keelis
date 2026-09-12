import { describe, expect, it } from 'vitest'
import { bicMatchesIban, checkIban, formatIban, ibanCountry, isValidBic, isValidIban, normalizeIban } from './iban'

// Published specimen IBANs — the shapes banks print as examples, which satisfy mod 97.
const SN = 'SN08SN0100152000048500003035'
const CI = 'CI93CI0080111301134291200589'
const FR = 'FR1420041010050500013M02606'
const DE = 'DE89370400440532013000'
const GB = 'GB82WEST12345698765432'

describe('checkIban', () => {
  it('accepts West African IBANs, which are checked exactly like European ones', () => {
    expect(isValidIban(SN)).toBe(true)
    expect(isValidIban(CI)).toBe(true)
  })

  it('accepts the anchors', () => {
    for (const v of [FR, DE, GB]) expect(isValidIban(v)).toBe(true)
  })

  it('catches a single transposed digit — which is the point of the checksum', () => {
    const typo = SN.slice(0, 12) + SN[13] + SN[12] + SN.slice(14)
    expect(typo).not.toBe(SN)
    expect(checkIban(typo)).toBe('checksum')
  })

  it('says which thing is wrong, so the field can say it too', () => {
    expect(checkIban('')).toBe('empty')
    expect(checkIban('12SN0100152000048500003035')).toBe('shape')
    expect(checkIban('ZZ0812345678901234567890')).toBe('country')
    expect(checkIban('SN08SN01001520000485')).toBe('length')
    expect(checkIban(SN.slice(0, -1) + (SN.endsWith('5') ? '6' : '5'))).toBe('checksum')
  })

  it('tolerates how people actually paste an IBAN', () => {
    expect(isValidIban('sn08 sn01 0015 2000 0485 0000 3035')).toBe(true)
    expect(isValidIban('SN08-SN01-0015-2000-0485-0000-3035')).toBe(true)
    expect(normalizeIban(' sn08 sn01 ')).toBe('SN08SN01')
  })

  it('takes the remainder in chunks, so a 34-character IBAN is not silently wrong', () => {
    // Malta's is 31 characters — long enough that Number(digits) loses precision, which is
    // the bug this guards. A valid one must still come back valid.
    const MT = 'MT84MALT011000012345MTLCAST001S'
    // Not in the length table on purpose: the country gate should fire before the checksum.
    expect(checkIban(MT)).toBe('country')
    // And a long *known* country still checks out digit for digit.
    expect(isValidIban('MU17BOMM0101101030300200000MUR')).toBe(true)
  })

  it('reads the country off the front', () => {
    expect(ibanCountry(SN)).toBe('SN')
    expect(ibanCountry('  ci93...')).toBe('CI')
    expect(ibanCountry('93CI')).toBeNull()
  })

  it('prints it in fours, the way a bank does', () => {
    expect(formatIban(DE)).toBe('DE89 3704 0044 0532 0130 00')
  })
})

describe('BIC', () => {
  it('accepts 8 and 11 character forms', () => {
    expect(isValidBic('CBAOSNDA')).toBe(true)
    expect(isValidBic('CBAOSNDAXXX')).toBe(true)
    expect(isValidBic('bnpafrpp')).toBe(true)
  })

  it('rejects the near-misses', () => {
    expect(isValidBic('CBAOSND')).toBe(false)
    expect(isValidBic('CBAOSNDAXX')).toBe(false)
    expect(isValidBic('CB1OSNDA')).toBe(false)
  })

  it('flags a BIC pointing at a different country than the IBAN', () => {
    expect(bicMatchesIban('CBAOSNDA', SN)).toBe(true)
    expect(bicMatchesIban('BNPAFRPP', SN)).toBe(false)
    // Too little typed to contradict anything yet.
    expect(bicMatchesIban('CBAO', SN)).toBe(true)
  })
})
