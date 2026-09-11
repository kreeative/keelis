/**
 * Wizard state: the saved OnboardingState plus the few things that only live
 * for the duration of the session (the demo code hint returned by requestCode).
 * Every step reads and writes through here so a reload resumes at the right place.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { ApiError, type OnboardingState } from '@/api/types'
import { nextStep, type StepSlug } from './steps'

interface State {
  ready: boolean
  error: ApiError | null
  data: OnboardingState
  devHint: string | null
}

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; data: OnboardingState }
  | { type: 'failed'; error: ApiError }
  | { type: 'merge'; patch: Partial<OnboardingState> }
  | { type: 'hint'; devHint: string | null }

const INITIAL: State = { ready: false, error: null, data: { step: 'email' }, devHint: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, error: null }
    case 'loaded':
      return { ...state, ready: true, error: null, data: action.data }
    case 'failed':
      return { ...state, error: action.error }
    case 'merge':
      return { ...state, data: { ...state.data, ...action.patch } }
    case 'hint':
      return { ...state, devHint: action.devHint }
  }
}

interface WizardValue {
  ready: boolean
  error: ApiError | null
  data: OnboardingState
  devHint: string | null
  setDevHint: (hint: string | null) => void
  /** Local-only merge (no network) */
  merge: (patch: Partial<OnboardingState>) => void
  /** Persist through the API, then merge locally */
  save: (patch: Partial<OnboardingState>) => Promise<void>
  /** Navigate to the step that follows `from` */
  goNext: (from: StepSlug) => void
  reload: () => void
}

const Ctx = createContext<WizardValue | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const navigate = useNavigate()

  const load = useCallback(() => {
    dispatch({ type: 'loading' })
    let alive = true
    api.auth
      .getOnboarding()
      .then((data) => alive && dispatch({ type: 'loaded', data }))
      .catch((err: unknown) => alive && dispatch({ type: 'failed', error: err instanceof ApiError ? err : new ApiError('Impossible de reprendre votre inscription.', 'unknown') }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => load(), [load])

  const value = useMemo<WizardValue>(
    () => ({
      ready: state.ready,
      error: state.error,
      data: state.data,
      devHint: state.devHint,
      setDevHint: (devHint) => dispatch({ type: 'hint', devHint }),
      merge: (patch) => dispatch({ type: 'merge', patch }),
      save: async (patch) => {
        const data = await api.auth.saveOnboarding(patch)
        dispatch({ type: 'loaded', data })
      },
      goNext: (from) => {
        const next = nextStep(from)
        if (next) navigate(`/inscription/${next}`)
      },
      reload: () => {
        load()
      },
    }),
    [state, navigate, load],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWizard(): WizardValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}

/** Turn an unknown rejection into an ApiError with a French fallback message. */
export function asApiError(err: unknown, fallback: string): ApiError {
  return err instanceof ApiError ? err : new ApiError(fallback, 'unknown')
}
