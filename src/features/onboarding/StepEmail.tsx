import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { Field } from '@/components'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function StepEmail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const connexion = params.get('mode') === 'connexion'
  const { data, merge, setDevHint } = useWizard()
  const focusRef = useStepFocus()
  const [email, setEmail] = useState(data.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const value = email.trim()
  const valid = EMAIL_RE.test(value)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.auth.requestCode(value)
      setDevHint(result.devHint ?? null)
      merge({ email: value, step: 'code' })
      navigate(connexion ? '/inscription/code?mode=connexion' : '/inscription/code')
    } catch (err) {
      const apiErr = asApiError(err, 'Impossible d’envoyer le code. Réessayez.')
      setError(apiErr.details?.email ?? apiErr.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={connexion ? 'Connexion' : stepEyebrow('courriel')}
      title="Quelle est votre adresse courriel ?"
      description={connexion ? 'Entrez l’adresse associée à votre compte Kaalis.' : 'Nous vous enverrons un code à six chiffres pour la confirmer.'}
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <Field
        label="Adresse courriel"
        hideLabel
        type="email"
        inputMode="email"
        autoComplete="email"
        ref={focusRef}
        spellCheck={false}
        placeholder="nom@exemple.ca"
        value={email}
        error={error ?? undefined}
        onChange={(e) => {
          setEmail(e.target.value)
          setError(null)
        }}
      />
    </StepShell>
  )
}
