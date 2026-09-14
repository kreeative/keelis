/**
 * How each transfer rail identifies the person receiving the money, and what counts as a
 * usable value.
 *
 * This lives in `lib/` rather than beside the form because **both ends need it**. The send
 * screen used to check the recipient with an email regex whatever the operator was, and
 * the mock back-end did the same on its side — so a Wave transfer, addressed to a phone
 * number, was rejected as « Courriel du destinataire invalide » even after the form had
 * been taught to ask for a phone. Two copies of a rule is one copy too many when the rule
 * decides whether somebody's money moves.
 *
 * The formats are deliberately loose. Fifteen operators reach dozens of numbering plans,
 * and the receiving operator is the only one that can really say whether a number exists.
 * What these catch is a value that is not the right *kind* of thing.
 */
import type { TransferHandle } from '@/api/types'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[\d\s().-]{8,20}$/
const TAG_RE = /^@?[A-Za-z0-9._-]{3,30}$/

export interface HandleRule {
  test: (v: string) => boolean
  /** Its own sentence: « invalide » says nothing about where to look. */
  error: string
}

export const HANDLE_RULE: Readonly<Record<TransferHandle, HandleRule>> = {
  phone: {
    test: (v) => PHONE_RE.test(v.trim()) && (v.match(/\d/g)?.length ?? 0) >= 8,
    error: 'Entrez le numéro de téléphone du destinataire, indicatif compris.',
  },
  email: {
    test: (v) => EMAIL_RE.test(v.trim()),
    error: 'Entrez une adresse courriel valide.',
  },
  tag: {
    test: (v) => TAG_RE.test(v.trim()),
    error: 'Entrez l’identifiant du destinataire, par exemple @aissatou.',
  },
  account: {
    test: (v) => v.trim().length >= 3,
    error: 'Indiquez comment le destinataire sera identifié au guichet.',
  },
}

/**
 * The rule to apply. Before an operator is chosen the rail is unknown, and in this market
 * the phone number is the overwhelmingly likely answer — not an email address, which is
 * what a Canadian e-Transfer form would have assumed.
 */
export function handleRule(handle: TransferHandle | undefined): HandleRule {
  return HANDLE_RULE[handle ?? 'phone']
}
