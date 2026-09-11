/**
 * The nine wizard steps, their order, and how a saved OnboardingState maps back
 * to a step (so a reload resumes exactly where the person stopped).
 *
 * The API stores a coarse step ('identity' covers nom + naissance + adresse);
 * the finer resume point is derived from which fields are already filled.
 */
import type { OnboardingState } from '@/api/types'

export const STEPS = ['courriel', 'code', 'nom', 'naissance', 'adresse', 'piece', 'deux-facteurs', 'nip', 'produit'] as const

export type StepSlug = (typeof STEPS)[number]

export const STEP_COUNT = STEPS.length

export function isStepSlug(value: string | undefined): value is StepSlug {
  return !!value && (STEPS as readonly string[]).includes(value)
}

export function stepIndex(slug: StepSlug): number {
  return STEPS.indexOf(slug)
}

export function nextStep(slug: StepSlug): StepSlug | null {
  return STEPS[stepIndex(slug) + 1] ?? null
}

export function previousStep(slug: StepSlug): StepSlug | null {
  const i = stepIndex(slug)
  return i > 0 ? (STEPS[i - 1] ?? null) : null
}

/** Which step should be shown for a saved state. */
export function resumeSlug(state: OnboardingState): StepSlug {
  switch (state.step) {
    case 'code':
      return 'code'
    case 'identity':
      if (!state.firstName || !state.lastName) return 'nom'
      if (!state.dateOfBirth) return 'naissance'
      if (!state.address) return 'adresse'
      return 'piece'
    case 'document':
      return state.documentUploaded ? 'deux-facteurs' : 'piece'
    case 'twofactor':
      return state.twoFactorEnabled === undefined ? 'deux-facteurs' : 'nip'
    case 'product':
    case 'done':
      return 'produit'
    case 'email':
    default:
      return 'courriel'
  }
}

/** « Étape 3 sur 9 » */
export function stepEyebrow(slug: StepSlug): string {
  return `Étape ${stepIndex(slug) + 1} sur ${STEP_COUNT}`
}
