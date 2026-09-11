import { useState } from 'react'
import { Field } from '@/components'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

export function StepName() {
  const { data, save, goNext } = useWizard()
  const focusRef = useStepFocus()
  const [firstName, setFirstName] = useState(data.firstName ?? '')
  const [lastName, setLastName] = useState(data.lastName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await save({ firstName: firstName.trim(), lastName: lastName.trim(), step: 'identity' })
      goNext('nom')
    } catch (err) {
      setError(asApiError(err, 'Impossible d’enregistrer votre nom.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={stepEyebrow('nom')}
      title="Comment vous appelez-vous ?"
      description="Utilisez le nom qui figure sur votre pièce d’identité."
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <div className={styles.fields}>
        <Field label="Prénom" autoComplete="given-name" ref={focusRef} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Field label="Nom" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}
