import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { Field, Icon } from '@/components'
import { StepShell } from './StepShell'
import shell from './StepShell.module.css'
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
      /* The first screen is the door, and the reference names it — « Create your account » —
         rather than asking; the question is the field's own label. Signing in keeps the
         question, since that door is /bienvenue and this is its second chance. */
      title={connexion ? 'Quelle est votre adresse courriel ?' : 'Créez votre compte'}
      description={connexion ? 'Entrez l’adresse associée à votre compte Keewal Meere.' : 'Entrez votre adresse courriel : nous vous enverrons un code à six chiffres pour la confirmer.'}
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
      footer={
        connexion ? null : (
          <p className={`t-small t-muted ${shell.legal}`}>
            En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité de Keewal Meere.{' '}
            <Link to="/entreprise" className={shell.legalLink}>
              Les lire
            </Link>
          </p>
        )
      }
    >
      <Field
        label="Adresse courriel"
        leading={<Icon name="mail" size={18} />}
        chip
        type="email"
        inputMode="email"
        autoComplete="email"
        ref={focusRef}
        spellCheck={false}
        placeholder="nom@exemple.sn"
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
