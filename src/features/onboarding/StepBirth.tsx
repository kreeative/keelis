import { useMemo, useState } from 'react'
import { Field } from '@/components'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'

const MIN_AGE = 18

/** YYYY-MM-DD of the most recent date that is still 18 years ago. */
function maxBirthDate(now = new Date()): string {
  const d = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StepBirth() {
  const { data, save, goNext } = useWizard()
  const focusRef = useStepFocus()
  const [value, setValue] = useState(data.dateOfBirth ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const max = useMemo(() => maxBirthDate(), [])

  const submit = async () => {
    if (value > max) {
      setError(`Vous devez avoir ${MIN_AGE} ans.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save({ dateOfBirth: value, step: 'identity' })
      goNext('naissance')
    } catch (err) {
      setError(asApiError(err, 'Impossible d’enregistrer votre date de naissance.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={stepEyebrow('naissance')}
      title="Quelle est votre date de naissance ?"
      description={`Keewal Meere est offert aux personnes de ${MIN_AGE} ans et plus.`}
      submitDisabled={value.length === 0}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <Field
        label="Date de naissance"
        hideLabel
        type="date"
        autoComplete="bday"
        ref={focusRef}
        max={max}
        value={value}
        error={error ?? undefined}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
      />
    </StepShell>
  )
}
