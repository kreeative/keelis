/**
 * How each transfer rail identifies the person receiving the money — and what the field
 * asking for it has to be.
 *
 * The send form used to ask for « Courriel » whatever the operator was: a hard-coded
 * `type="email"` with an email keyboard, an email autocomplete and an email validator. Its
 * *label* adapted to the operator, so choosing Wave produced a field titled « Numéro de
 * téléphone » that opened the email keyboard and then rejected a phone number as an
 * invalid address. On the most-used rail in West Africa, the form did not work at all.
 *
 * So the label, the keyboard, the autocomplete, the placeholder, the check and the failure
 * sentence all come from one place, keyed by the operator's own `handle`.
 */
import type { TransferHandle } from '@/api/types'

export interface HandleField {
  label: string
  placeholder: string
  type: 'text' | 'email' | 'tel'
  inputMode: 'text' | 'email' | 'tel'
  autoComplete: string
  /** True when the value is usable. */
  test: (v: string) => boolean
  /** Its own sentence: « invalide » on a field like this says nothing about where to look. */
  error: string
  hint?: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/* Loose on purpose: the numbering plans across the fifteen countries these operators reach
   do not share a length, and the receiving operator is the one that can really say. What
   this catches is a value that is not a phone number at all. */
const PHONE_RE = /^\+?[\d\s().-]{8,20}$/
const TAG_RE = /^@?[A-Za-z0-9._-]{3,30}$/

export const HANDLE_FIELD: Readonly<Record<TransferHandle, HandleField>> = {
  phone: {
    label: 'Numéro de téléphone',
    placeholder: '+221 77 000 00 00',
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    test: (v) => PHONE_RE.test(v.trim()) && (v.match(/\d/g)?.length ?? 0) >= 8,
    error: 'Entrez le numéro de téléphone du destinataire, indicatif compris.',
    hint: 'Le numéro sur lequel le compte Mobile Money est ouvert.',
  },
  email: {
    label: 'Adresse courriel',
    placeholder: 'nom@exemple.sn',
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    test: (v) => EMAIL_RE.test(v.trim()),
    error: 'Entrez une adresse courriel valide.',
  },
  tag: {
    label: 'Identifiant',
    placeholder: '@aissatou',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'username',
    test: (v) => TAG_RE.test(v.trim()),
    error: 'Entrez l’identifiant du destinataire, par exemple @aissatou.',
  },
  account: {
    label: 'Coordonnées du destinataire',
    placeholder: 'Nom complet et ville de retrait',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'off',
    test: (v) => v.trim().length >= 3,
    error: 'Indiquez comment le destinataire sera identifié au guichet.',
    hint: 'Ce que le guichet demandera au retrait.',
  },
}

/**
 * The handle to ask for. Before an operator is chosen the rail is unknown, and in this
 * market the phone number is the overwhelmingly likely answer — not an email address,
 * which is what a Canadian e-Transfer form would have assumed.
 */
export function handleField(handle: TransferHandle | undefined): HandleField {
  return HANDLE_FIELD[handle ?? 'phone']
}
