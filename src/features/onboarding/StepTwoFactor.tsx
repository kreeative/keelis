import { useState } from 'react'
import { Icon, ListRow, Switch } from '@/components'
import { StepShell } from './StepShell'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

export function StepTwoFactor() {
  const { data, save, goNext } = useWizard()
  const [enabled, setEnabled] = useState(data.twoFactorEnabled ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await save({ twoFactorEnabled: enabled, step: 'twofactor' })
      goNext('deux-facteurs')
    } catch (err) {
      setError(asApiError(err, 'Impossible d’enregistrer ce réglage.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell eyebrow={stepEyebrow('deux-facteurs')} title="Protégez votre compte" submitting={busy} onSubmit={() => void submit()}>
      <p className={styles.lede}>La double authentification demande un code à usage unique à chaque connexion depuis un nouvel appareil.</p>
      <p className={styles.note}>Vous pourrez la modifier à tout moment dans Profil, section Sécurité.</p>
      <ListRow
        static
        leading={
          <span className={styles.circle} aria-hidden="true">
            <Icon name="shield-check" size={20} />
          </span>
        }
        title="Double authentification"
        subtitle={enabled ? 'Activée' : 'Désactivée'}
        trailing={<Switch checked={enabled} onChange={setEnabled} label="Double authentification" />}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}
