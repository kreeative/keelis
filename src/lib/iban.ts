/**
 * IBAN and BIC validation for the wire transfer flow.
 *
 * An IBAN carries its own checksum, so a typo is catchable before the money moves rather
 * than after — which is the whole reason the standard exists. This implements the real
 * ISO 13616 check (move the first four characters to the end, letters become 10–35, the
 * whole thing mod 97 must be 1), not a length-and-shape guess.
 *
 * The length table matters as much as the checksum: an IBAN of the wrong length for its
 * country can still pass mod 97 by chance about one time in 97, and Senegal's is 28
 * characters while Côte d'Ivoire's is also 28 and France's is 27. The UEMOA and CEMAC
 * countries all issue IBANs, so a West African wire is validated exactly like a European
 * one — which is why this is worth doing properly rather than accepting free text.
 */

/** Length of a complete IBAN, by country code. */
const IBAN_LENGTH: Readonly<Record<string, number>> = {
  // UEMOA (BCEAO)
  SN: 28, CI: 28, ML: 28, BF: 28, BJ: 28, NE: 28, TG: 28, GW: 25,
  // CEMAC (BEAC)
  CM: 27, GA: 27, TD: 27, CF: 27, CG: 27, GQ: 27,
  // Other African issuers
  MA: 28, TN: 24, DZ: 26, EG: 29, MU: 30, MR: 27, MG: 27, CV: 25, ST: 25, AO: 25,
  // The anchors and common counterparties
  FR: 27, BE: 16, DE: 22, ES: 24, IT: 27, PT: 25, NL: 18, LU: 20, CH: 21, GB: 22, IE: 22,
}

/** Uppercase, strip spaces and the separators people paste in from a bank statement. */
export function normalizeIban(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-_]/g, '')
}

/** Group in fours, the way every bank prints it. */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})/g, '$1 ').trim()
}

/** The country an IBAN claims, or null if it does not start with two letters. */
export function ibanCountry(raw: string): string | null {
  const v = normalizeIban(raw)
  return /^[A-Z]{2}/.test(v) ? v.slice(0, 2) : null
}

/**
 * ISO 13616 mod-97 check.
 *
 * The remainder is taken in chunks rather than on one huge integer: an IBAN can be 34
 * characters, which becomes a 68-digit number — past what a JavaScript number can hold
 * exactly, so a naive `Number(...) % 97` silently returns the wrong answer for long ones.
 */
function mod97(digits: string): number {
  let rest = 0
  for (let i = 0; i < digits.length; i += 7) {
    rest = Number(String(rest) + digits.slice(i, i + 7)) % 97
  }
  return rest
}

export type IbanError = 'empty' | 'shape' | 'country' | 'length' | 'checksum'

/** Validate an IBAN, saying *which* thing is wrong so the field can say it too. */
export function checkIban(raw: string): IbanError | null {
  const v = normalizeIban(raw)
  if (!v) return 'empty'
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v)) return 'shape'
  const expected = IBAN_LENGTH[v.slice(0, 2)]
  if (expected === undefined) return 'country'
  if (v.length !== expected) return 'length'
  const rearranged = v.slice(4) + v.slice(0, 4)
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  return mod97(digits) === 1 ? null : 'checksum'
}

export function isValidIban(raw: string): boolean {
  return checkIban(raw) === null
}

/** The countries this app will accept an IBAN from, for the field's hint. */
export function knownIbanCountries(): string[] {
  return Object.keys(IBAN_LENGTH)
}

/**
 * BIC / SWIFT: four letters for the bank, two for the country, two for the location, and
 * an optional three-character branch. "XXX" as the branch means head office and is valid.
 */
export function isValidBic(raw: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(raw.toUpperCase().replace(/\s/g, ''))
}

/** A BIC's country code must agree with the IBAN's, or the money is going somewhere else. */
export function bicMatchesIban(bic: string, iban: string): boolean {
  const b = bic.toUpperCase().replace(/\s/g, '')
  const c = ibanCountry(iban)
  if (!c || b.length < 6) return true // not enough typed yet to contradict anything
  return b.slice(4, 6) === c
}
