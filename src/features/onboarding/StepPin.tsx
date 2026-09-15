import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import { Button, Keypad } from '@/components'
import { StepShell } from './StepShell'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

const LENGTH = 4

export function StepPin() {
  const { save, goNext } = useWizard()
  const [phase, setPhase] = useState<'choose' | 'confirm'>('choose')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)

  const value = phase === 'choose' ? pin : confirm
  const setValue = phase === 'choose' ? setPin : setConfirm

  const restart = useCallback(() => {
    setPin('')
    setConfirm('')
    setPhase('choose')
  }, [])

  const submit = useCallback(
    async (code: string) => {
      setBusy(true)
      setError(null)
      try {
        await api.auth.setPin(code)
        await save({ step: 'product' })
        goNext('nip')
      } catch (err) {
        setError(asApiError(err, 'Impossible d’enregistrer votre NIP.').message)
        restart()
        sent.current = false
      } finally {
        setBusy(false)
      }
    },
    [save, goNext, restart],
  )

  // Choose → confirm, then compare.
  useEffect(() => {
    if (phase === 'choose' && pin.length === LENGTH) {
      setPhase('confirm')
      setError(null)
    }
  }, [phase, pin])

  useEffect(() => {
    if (phase !== 'confirm' || confirm.length !== LENGTH || sent.current) return
    if (confirm !== pin) {
      setError('Les deux NIP ne correspondent pas. Recommencez.')
      restart()
      return
    }
    sent.current = true
    void submit(confirm)
  }, [phase, confirm, pin, restart, submit])

  return (
    <StepShell
      eyebrow={stepEyebrow('nip')}
      title={phase === 'choose' ? 'Choisissez un NIP à 4 chiffres' : 'Confirmez votre NIP'}
      description={phase === 'choose' ? 'Il déverrouille Keewal Meere et confirme vos paiements.' : 'Entrez les mêmes quatre chiffres une seconde fois.'}
      hideSubmit
      footer={
        phase === 'confirm' ? (
          <Button variant="ghost" block onClick={restart} disabled={busy}>
            Recommencer
          </Button>
        ) : null
      }
    >
      <div className={styles.pin}>
        <div className={styles.dots} role="status" aria-label={`${value.length} chiffres saisis sur ${LENGTH}`}>
          {Array.from({ length: LENGTH }).map((_, i) => (
            <span key={i} className={i < value.length ? styles.dotOn : styles.dot} />
          ))}
        </div>
        <p className={styles.pinError} role="alert">
          {error ?? ' '}
        </p>
        <Keypad value={value} onChange={(v) => { setError(null); setValue(v) }} integerOnly maxLength={LENGTH} disabled={busy} />
      </div>
    </StepShell>
  )
}
