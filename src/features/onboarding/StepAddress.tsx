import { useState } from 'react'
import { AddressFields, addressIncomplete, emptyAddress, postalProblem, type AddressDraft } from '@/features/shared'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

export function StepAddress() {
  const { data, save, goNext } = useWizard()
  const focusRef = useStepFocus()
  /* The six controls and every rule about them live in `AddressFields` — this step and
     /profil/informations both mount it, so a Sénégalais address cannot be valid on one
     screen and refused on the other. */
  const [address, setAddress] = useState<AddressDraft>(() => emptyAddress(data.address))
  const [postalError, setPostalError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = !addressIncomplete(address)

  const submit = async () => {
    const problem = postalProblem(address)
    if (problem) {
      setPostalError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save({
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() || undefined,
          city: address.city.trim(),
          province: address.province.trim(),
          postalCode: address.postalCode,
          country: address.country,
        },
        step: 'document',
      })
      goNext('adresse')
    } catch (err) {
      setError(asApiError(err, 'Impossible d’enregistrer votre adresse.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={stepEyebrow('adresse')}
      title="Où habitez-vous ?"
      description="Votre adresse résidentielle, pas une boîte postale."
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <AddressFields
        ref={focusRef}
        className={styles.fields}
        value={address}
        onChange={(next) => {
          setAddress(next)
          setPostalError(null)
          setError(null)
        }}
        postalError={postalError}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}
