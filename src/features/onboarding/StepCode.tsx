import { startTransition, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { Button, Field } from '@/components'
import { useSession, useToast } from '@/store'
import { DEMO_CODE } from './demo'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

const CODE_LENGTH = 6

/** « 246 810 » — grouped for reading, never for typing. */
function groupCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

export function StepCode() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const connexion = params.get('mode') === 'connexion'
  const { data, merge, devHint, setDevHint, goNext } = useWizard()
  const { setSession } = useSession()
  const { toast } = useToast()
  const focusRef = useStepFocus()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const submitted = useRef<string | null>(null)
  const email = data.email ?? ''

  const verify = async (value: string) => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.auth.verifyCode(email, value)
      if (result.session) {
        const session = result.session
        startTransition(() => {
          setSession(session)
          navigate('/', { replace: true })
        })
        return
      }
      merge({ step: 'identity' })
      goNext('code')
    } catch (err) {
      const apiErr = asApiError(err, 'Impossible de vérifier le code.')
      setError(apiErr.details?.code ?? apiErr.message)
      setCode('')
      submitted.current = null
    } finally {
      setBusy(false)
    }
  }

  // Auto-submit as soon as the six digits are in (once per value).
  useEffect(() => {
    if (code.length !== CODE_LENGTH || busy || submitted.current === code) return
    submitted.current = code
    void verify(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const resend = async () => {
    setResending(true)
    try {
      const result = await api.auth.requestCode(email)
      setDevHint(result.devHint ?? null)
      toast('Un nouveau code a été envoyé.')
    } catch (err) {
      toast(asApiError(err, 'Impossible de renvoyer le code.').message, 'error')
    } finally {
      setResending(false)
    }
  }

  return (
    <StepShell
      eyebrow={connexion ? 'Connexion' : stepEyebrow('code')}
      title="Entrez le code reçu par courriel"
      description={email ? `Code envoyé à ${email}.` : 'Entrez le code à six chiffres.'}
      submitDisabled={code.length !== CODE_LENGTH}
      submitting={busy}
      onSubmit={() => void verify(code)}
      footer={
        <Button variant="ghost" block onClick={() => void resend()} loading={resending} disabled={busy}>
          Renvoyer le code
        </Button>
      }
    >
      <Field
        className={styles.codeField}
        label="Code à six chiffres"
        hideLabel
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        ref={focusRef}
        placeholder="······"
        value={code}
        error={error ?? undefined}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
          setError(null)
        }}
      />
      <p className={styles.demoHint}>Code de démonstration : {groupCode(devHint ?? DEMO_CODE)}</p>
    </StepShell>
  )
}
