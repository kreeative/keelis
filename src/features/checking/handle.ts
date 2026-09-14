/**
 * The recipient field, per rail: what it is called, what keyboard it opens, and what it
 * checks.
 *
 * The form used to ask for « Courriel » whatever the operator was — a hard-coded
 * `type="email"` with an email keyboard, an email autocomplete and an email validator. Its
 * *label* adapted to the operator, so choosing Wave produced a field titled « Numéro de
 * téléphone » that opened the email keyboard and then rejected a phone number as an
 * invalid address. On the most-used rail in West Africa the form did not work at all.
 *
 * The rule itself lives in `lib/transferHandle.ts`, because the back-end checks the same
 * value and two copies of that rule is one too many. What is here is only presentation.
 */
import type { TransferHandle } from '@/api/types'
import { handleRule } from '@/lib/transferHandle'

export interface HandleField {
  label: string
  placeholder: string
  type: 'text' | 'email' | 'tel'
  inputMode: 'text' | 'email' | 'tel'
  autoComplete: string
  test: (v: string) => boolean
  error: string
  hint?: string
}

interface Presentation {
  label: string
  placeholder: string
  type: HandleField['type']
  inputMode: HandleField['inputMode']
  autoComplete: string
  hint?: string
}

const PRESENTATION: Readonly<Record<TransferHandle, Presentation>> = {
  phone: {
    label: 'Numéro de téléphone',
    placeholder: '+221 77 000 00 00',
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    hint: 'Le numéro sur lequel le compte Mobile Money est ouvert.',
  },
  email: {
    label: 'Adresse courriel',
    placeholder: 'nom@exemple.sn',
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
  },
  tag: {
    label: 'Identifiant',
    placeholder: '@aissatou',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'username',
  },
  account: {
    label: 'Coordonnées du destinataire',
    placeholder: 'Nom complet et ville de retrait',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'off',
    hint: 'Ce que le guichet demandera au retrait.',
  },
}

function field(handle: TransferHandle): HandleField {
  return { ...PRESENTATION[handle], ...handleRule(handle) }
}

export const HANDLE_FIELD: Readonly<Record<TransferHandle, HandleField>> = {
  phone: field('phone'),
  email: field('email'),
  tag: field('tag'),
  account: field('account'),
}

/** Before an operator is chosen the rail is unknown; here the phone number is the default. */
export function handleField(handle: TransferHandle | undefined): HandleField {
  return HANDLE_FIELD[handle ?? 'phone']
}
